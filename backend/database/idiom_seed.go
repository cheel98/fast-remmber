package database

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"log"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

//go:embed testdata/idiom_seed_manifest.json
var idiomSeedManifestBytes []byte

type idiomSeedManifest struct {
	Owner           string   `json:"owner"`
	Prefixes        []string `json:"prefixes"`
	Suffixes        []string `json:"suffixes"`
	Themes          []string `json:"themes"`
	SynonymStrength float64  `json:"synonymStrength"`
	AntonymStrength float64  `json:"antonymStrength"`
	RelatedStrength float64  `json:"relatedStrength"`
}

type idiomSeedNode struct {
	Name     string `json:"name"`
	Meaning  string `json:"meaning"`
	Emotions string `json:"emotions"`
	Examples string `json:"examples"`
}

type idiomSeedRelation struct {
	Source         string  `json:"source"`
	Target         string  `json:"target"`
	Strength       float64 `json:"strength"`
	SimilarityType string  `json:"similarityType"`
	Difference     string  `json:"difference"`
}

const fallbackSeedOwner = "__seed_template__"

func ensureSeedTemplate(ctx context.Context) error {
	if Driver == nil {
		return nil
	}

	manifest, err := loadSeedManifest()
	if err != nil {
		return err
	}

	owner := manifest.Owner
	if owner == "" {
		owner = fallbackSeedOwner
	}

	nodes, synonymRelations, antonymRelations, relatedRelations := buildSeedGraph(manifest)
	if len(nodes) == 0 {
		return nil
	}

	session := Driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	defer session.Close(ctx)

	created, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		existingCount, err := countUserIdioms(ctx, tx, owner)
		if err != nil {
			return false, err
		}
		if err := upsertSeedNodes(ctx, tx, owner, nodes); err != nil {
			return false, err
		}
		if err := upsertSeedRelations(ctx, tx, owner, "SYNONYM", synonymRelations); err != nil {
			return false, err
		}
		if err := upsertSeedRelations(ctx, tx, owner, "ANTONYM", antonymRelations); err != nil {
			return false, err
		}
		if err := upsertSeedRelations(ctx, tx, owner, "RELATED", relatedRelations); err != nil {
			return false, err
		}

		return existingCount < len(nodes), nil
	})
	if err != nil {
		return err
	}

	if created == true {
		log.Printf("Seeded test idiom graph template into Neo4j: owner=%s, nodes=%d, relationships=%d", owner, len(nodes), len(synonymRelations)+len(antonymRelations)+len(relatedRelations))
	}

	return nil
}

func EnsureUserSeedGraph(ctx context.Context, owner string) error {
	if Driver == nil || owner == "" {
		return nil
	}

	manifest, err := loadSeedManifest()
	if err != nil {
		return err
	}

	seedOwner := manifest.Owner
	if seedOwner == "" {
		seedOwner = fallbackSeedOwner
	}
	if owner == seedOwner {
		return nil
	}

	if err := ensureSeedTemplate(ctx); err != nil {
		return err
	}

	session := Driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	defer session.Close(ctx)

	copied, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		existingCount, err := countUserIdioms(ctx, tx, owner)
		if err != nil {
			return false, err
		}

		if err := cloneSeedNodes(ctx, tx, seedOwner, owner); err != nil {
			return false, err
		}
		for _, relType := range []string{"SYNONYM", "ANTONYM", "RELATED"} {
			if err := cloneSeedRelations(ctx, tx, seedOwner, owner, relType); err != nil {
				return false, err
			}
		}

		return existingCount < expectedSeedNodeCount(manifest), nil
	})
	if err != nil {
		return err
	}

	if copied == true {
		log.Printf("Provisioned seeded idiom graph for user=%s from template=%s", owner, seedOwner)
	}

	return nil
}

func EnsureSeedGraphsForExistingUsers(ctx context.Context) error {
	if Driver == nil {
		return nil
	}

	manifest, err := loadSeedManifest()
	if err != nil {
		return err
	}

	seedOwner := manifest.Owner
	if seedOwner == "" {
		seedOwner = fallbackSeedOwner
	}

	if err := ensureSeedTemplate(ctx); err != nil {
		return err
	}

	session := Driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		res, err := tx.Run(ctx,
			`MATCH (u:User)
			 RETURN u.username AS username`,
			nil,
		)
		if err != nil {
			return nil, err
		}

		usernames := make([]string, 0)
		for res.Next(ctx) {
			value, _ := res.Record().Get("username")
			username, _ := value.(string)
			if username == "" || username == seedOwner {
				continue
			}
			usernames = append(usernames, username)
		}

		return usernames, res.Err()
	})
	if err != nil {
		return err
	}

	usernames, _ := result.([]string)
	for _, username := range usernames {
		if err := EnsureUserSeedGraph(ctx, username); err != nil {
			return err
		}
	}

	return nil
}

func loadSeedManifest() (idiomSeedManifest, error) {
	var manifest idiomSeedManifest
	if err := json.Unmarshal(idiomSeedManifestBytes, &manifest); err != nil {
		return idiomSeedManifest{}, err
	}
	return manifest, nil
}

func buildSeedGraph(manifest idiomSeedManifest) ([]idiomSeedNode, []idiomSeedRelation, []idiomSeedRelation, []idiomSeedRelation) {
	if len(manifest.Prefixes) == 0 || len(manifest.Suffixes) == 0 {
		return nil, nil, nil, nil
	}

	clusterNames := make([][]string, len(manifest.Prefixes))
	nodes := make([]idiomSeedNode, 0, len(manifest.Prefixes)*len(manifest.Suffixes))

	for clusterIndex, prefix := range manifest.Prefixes {
		theme := ""
		if len(manifest.Themes) > 0 {
			theme = manifest.Themes[clusterIndex%len(manifest.Themes)]
		}

		for suffixIndex, suffix := range manifest.Suffixes {
			name := prefix + suffix
			clusterNames[clusterIndex] = append(clusterNames[clusterIndex], name)
			nodes = append(nodes, idiomSeedNode{
				Name:     name,
				Meaning:  fmt.Sprintf("Seed graph node. Theme=%s, cluster=%d, index=%d.", theme, clusterIndex+1, suffixIndex+1),
				Emotions: theme,
				Examples: "[]",
			})
		}
	}

	synonymRelations := make([]idiomSeedRelation, 0, len(nodes))
	for clusterIndex, names := range clusterNames {
		if len(names) < 2 {
			continue
		}

		theme := ""
		if len(manifest.Themes) > 0 {
			theme = manifest.Themes[clusterIndex%len(manifest.Themes)]
		}

		for i := range names {
			source := names[i]
			target := names[(i+1)%len(names)]
			synonymRelations = append(synonymRelations, idiomSeedRelation{
				Source:         source,
				Target:         target,
				Strength:       manifest.SynonymStrength,
				SimilarityType: theme + "-adjacent",
				Difference:     "Same cluster test link",
			})
		}
	}

	antonymRelations := make([]idiomSeedRelation, 0, len(nodes))
	half := len(clusterNames) / 2
	for leftCluster := 0; leftCluster < half; leftCluster++ {
		rightCluster := leftCluster + half
		if rightCluster >= len(clusterNames) {
			break
		}

		leftNames := clusterNames[leftCluster]
		rightNames := clusterNames[rightCluster]
		pairSize := minInt(len(leftNames), len(rightNames))
		for index := 0; index < pairSize; index++ {
			left := leftNames[index]
			right := rightNames[index]
			antonymRelations = append(antonymRelations,
				idiomSeedRelation{
					Source:         left,
					Target:         right,
					Strength:       manifest.AntonymStrength,
					SimilarityType: "contrast",
					Difference:     "Cross cluster contrast link",
				},
				idiomSeedRelation{
					Source:         right,
					Target:         left,
					Strength:       manifest.AntonymStrength,
					SimilarityType: "contrast",
					Difference:     "Cross cluster contrast link",
				},
			)
		}
	}

	relatedRelations := make([]idiomSeedRelation, 0, len(clusterNames))
	for clusterIndex, names := range clusterNames {
		if len(names) == 0 {
			continue
		}

		nextCluster := (clusterIndex + 1) % len(clusterNames)
		if len(clusterNames[nextCluster]) == 0 {
			continue
		}

		relatedRelations = append(relatedRelations, idiomSeedRelation{
			Source:         names[0],
			Target:         clusterNames[nextCluster][0],
			Strength:       manifest.RelatedStrength,
			SimilarityType: "spine",
			Difference:     "Cross cluster navigation link",
		})
	}

	return nodes, synonymRelations, antonymRelations, relatedRelations
}

func countUserIdioms(ctx context.Context, tx neo4j.ManagedTransaction, owner string) (int, error) {
	result, err := tx.Run(ctx,
		`MATCH (n:UserIdiom {owner: $owner})
		 RETURN count(n) AS count`,
		map[string]any{"owner": owner},
	)
	if err != nil {
		return 0, err
	}
	if !result.Next(ctx) {
		return 0, result.Err()
	}

	value, _ := result.Record().Get("count")
	switch typedValue := value.(type) {
	case int64:
		return int(typedValue), nil
	case int:
		return typedValue, nil
	default:
		return 0, nil
	}
}

func upsertSeedNodes(ctx context.Context, tx neo4j.ManagedTransaction, owner string, nodes []idiomSeedNode) error {
	if len(nodes) == 0 {
		return nil
	}

	_, err := tx.Run(ctx,
		`UNWIND $nodes AS node
		 MERGE (n:UserIdiom {owner: $owner, name: node.name})
		 SET n.meaning = node.meaning,
		     n.emotions = node.emotions,
		     n.examples = node.examples`,
		map[string]any{
			"owner": owner,
			"nodes": seedNodesParam(nodes),
		},
	)
	return err
}

func upsertSeedRelations(ctx context.Context, tx neo4j.ManagedTransaction, owner string, relationType string, relations []idiomSeedRelation) error {
	if len(relations) == 0 {
		return nil
	}

	query := fmt.Sprintf(
		`UNWIND $relations AS rel
		 MATCH (s:UserIdiom {owner: $owner, name: rel.source})
		 MATCH (t:UserIdiom {owner: $owner, name: rel.target})
		 MERGE (s)-[r:%s]->(t)
		 SET r.strength = rel.strength,
		     r.similarityType = rel.similarityType,
		     r.difference = rel.difference`,
		relationType,
	)

	_, err := tx.Run(ctx, query, map[string]any{
		"owner":     owner,
		"relations": seedRelationsParam(relations),
	})
	return err
}

func cloneSeedNodes(ctx context.Context, tx neo4j.ManagedTransaction, seedOwner string, owner string) error {
	_, err := tx.Run(ctx,
		`MATCH (seed:UserIdiom {owner: $seedOwner})
		 MERGE (copy:UserIdiom {owner: $owner, name: seed.name})
		 SET copy.meaning = seed.meaning,
		     copy.emotions = seed.emotions,
		     copy.examples = coalesce(seed.examples, "[]")`,
		map[string]any{
			"seedOwner": seedOwner,
			"owner":     owner,
		},
	)
	return err
}

func cloneSeedRelations(ctx context.Context, tx neo4j.ManagedTransaction, seedOwner string, owner string, relationType string) error {
	query := fmt.Sprintf(
		`MATCH (seedSource:UserIdiom {owner: $seedOwner})-[seedRel:%s]->(seedTarget:UserIdiom {owner: $seedOwner})
		 MATCH (copySource:UserIdiom {owner: $owner, name: seedSource.name})
		 MATCH (copyTarget:UserIdiom {owner: $owner, name: seedTarget.name})
		 MERGE (copySource)-[copyRel:%s]->(copyTarget)
		 SET copyRel.strength = coalesce(seedRel.strength, 0.5),
		     copyRel.similarityType = coalesce(seedRel.similarityType, ""),
		     copyRel.difference = coalesce(seedRel.difference, ""),
		     copyRel.sourceExample = coalesce(seedRel.sourceExample, ""),
		     copyRel.targetExample = coalesce(seedRel.targetExample, "")`,
		relationType,
		relationType,
	)

	_, err := tx.Run(ctx, query, map[string]any{
		"seedOwner": seedOwner,
		"owner":     owner,
	})
	return err
}

func minInt(left int, right int) int {
	if left < right {
		return left
	}
	return right
}

func expectedSeedNodeCount(manifest idiomSeedManifest) int {
	return len(manifest.Prefixes) * len(manifest.Suffixes)
}

func seedNodesParam(nodes []idiomSeedNode) []map[string]any {
	params := make([]map[string]any, 0, len(nodes))
	for _, node := range nodes {
		params = append(params, map[string]any{
			"name":     node.Name,
			"meaning":  node.Meaning,
			"emotions": node.Emotions,
			"examples": node.Examples,
		})
	}
	return params
}

func seedRelationsParam(relations []idiomSeedRelation) []map[string]any {
	params := make([]map[string]any, 0, len(relations))
	for _, relation := range relations {
		params = append(params, map[string]any{
			"source":         relation.Source,
			"target":         relation.Target,
			"strength":       relation.Strength,
			"similarityType": relation.SimilarityType,
			"difference":     relation.Difference,
		})
	}
	return params
}
