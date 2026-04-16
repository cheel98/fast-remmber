package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"fast-remmber-backend/database"
	"fast-remmber-backend/models"
	"fast-remmber-backend/services"

	"github.com/gin-gonic/gin"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

type ProcessRequest struct {
	Text string `json:"text" binding:"required"`
}

func AnalyzeIdiom(c *gin.Context) {
	user, ok := currentUserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req ProcessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := ensureUserCanUseAISearch(c.Request.Context(), user.Username); err != nil {
		if errors.Is(err, errAISearchBalanceExhausted) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify AI search balance"})
		return
	}

	result, err := services.ExtractIdiomRelations(c.Request.Context(), req.Text)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to extract from LLM: " + err.Error()})
		return
	}

	// Post-process to check if these idioms already exist in DB with meanings
	if database.Driver != nil {
		ctx := context.Background()
		session := database.Driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
		defer session.Close(ctx)

		_, err = session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
			// Collect all names to check
			names := []string{result.Idiom}
			for _, s := range result.Synonyms {
				names = append(names, s.Name)
			}
			for _, a := range result.Antonyms {
				names = append(names, a.Name)
			}

			// Query DB for existing meanings
			res, err := tx.Run(ctx,
				"MATCH (i:UserIdiom {owner: $owner}) WHERE i.name IN $names AND i.meaning IS NOT NULL RETURN i.name",
				map[string]any{
					"owner": user.Username,
					"names": names,
				})
			if err != nil {
				return nil, err
			}

			meaningMap := make(map[string]bool)
			for res.Next(ctx) {
				n, _ := res.Record().Get("i.name")
				name := stringValue(n)
				if name == "" {
					continue
				}
				meaningMap[name] = true
			}

			// Main idiom is now explored
			result.HasAIExplore = true

			// Update related idioms from map
			for i := range result.Synonyms {
				if meaningMap[result.Synonyms[i].Name] {
					result.Synonyms[i].HasAIExplore = true
				}
			}
			for i := range result.Antonyms {
				if meaningMap[result.Antonyms[i].Name] {
					result.Antonyms[i].HasAIExplore = true
				}
			}
			return nil, nil
		})
	}

	if database.Driver != nil {
		if err := saveDiscoveryRecord(c.Request.Context(), user.Username, req.Text, *result); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save discovery record: " + err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, result)
}

func SaveIdiom(c *gin.Context) {
	user, ok := currentUserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var body models.IdiomExtractionResult
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	examples := body.Examples
	if examples == nil {
		examples = []models.UsageExample{}
	}

	examplesJSON, err := json.Marshal(examples)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to serialize examples: " + err.Error()})
		return
	}

	if database.Driver != nil {
		ctx := context.Background()
		session := database.Driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
		defer session.Close(ctx)

		_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
			// Create or update the current user's idiom node.
			_, err := tx.Run(ctx,
				`MERGE (i:UserIdiom {owner: $owner, name: $name})
				 SET i.meaning = $meaning, i.emotions = $emotions, i.examples = $examples`,
				map[string]any{
					"owner":    user.Username,
					"name":     body.Idiom,
					"meaning":  body.Meaning,
					"emotions": body.Emotions,
					"examples": string(examplesJSON),
				})
			if err != nil {
				return nil, err
			}

			// Keep user-specific discovery links in sync with the current saved result.
			_, err = tx.Run(ctx,
				`MATCH (:UserIdiom {owner: $owner, name: $idiom})-[r:SYNONYM|ANTONYM]->(:UserIdiom {owner: $owner})
				 DELETE r`,
				map[string]any{
					"owner": user.Username,
					"idiom": body.Idiom,
				})
			if err != nil {
				return nil, err
			}

			// Create user-specific synonym relationships.
			for _, syn := range body.Synonyms {
				_, err = tx.Run(ctx,
					`MERGE (i:UserIdiom {owner: $owner, name: $idiom})
					 MERGE (s:UserIdiom {owner: $owner, name: $syn})
					 MERGE (i)-[r:SYNONYM]->(s)
					 SET r.strength = $strength,
					     r.similarityType = $similarityType,
					     r.difference = $difference,
					     r.sourceExample = $sourceExample,
					     r.targetExample = $targetExample`,
					map[string]any{
						"owner":          user.Username,
						"idiom":          body.Idiom,
						"syn":            syn.Name,
						"strength":       syn.Strength,
						"similarityType": syn.SimilarityType,
						"difference":     syn.Difference,
						"sourceExample":  syn.SourceExample,
						"targetExample":  syn.TargetExample,
					})
				if err != nil {
					return nil, err
				}
			}

			// Create user-specific antonym relationships.
			for _, ant := range body.Antonyms {
				_, err = tx.Run(ctx,
					`MERGE (i:UserIdiom {owner: $owner, name: $idiom})
					 MERGE (a:UserIdiom {owner: $owner, name: $ant})
					 MERGE (i)-[r:ANTONYM]->(a)
					 SET r.strength = $strength,
					     r.similarityType = $similarityType,
					     r.difference = $difference,
					     r.sourceExample = $sourceExample,
					     r.targetExample = $targetExample`,
					map[string]any{
						"owner":          user.Username,
						"idiom":          body.Idiom,
						"ant":            ant.Name,
						"strength":       ant.Strength,
						"similarityType": ant.SimilarityType,
						"difference":     ant.Difference,
						"sourceExample":  ant.SourceExample,
						"targetExample":  ant.TargetExample,
					})
				if err != nil {
					return nil, err
				}
			}
			return nil, nil
		})

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save to Neo4j: " + err.Error()})
			return
		}
	} else {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Neo4j is not connected"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Saved successfully!"})
}

func GetIdiomGraph(c *gin.Context) {
	user, ok := currentUserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Dummy query for the entire network or a bounded subgraph
	// In production, limit depth or filter by specific idiom
	if database.Driver == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Neo4j is not connected"})
		return
	}

	if err := database.EnsureUserSeedGraph(c.Request.Context(), user.Username); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare seeded graph: " + err.Error()})
		return
	}

	ctx := context.Background()
	session := database.Driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	options := parseGraphQueryOptions(c)
	result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		return loadGraphData(ctx, tx, user.Username, options)
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query graph: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

type graphQueryOptions struct {
	Mode   string
	Center string
	Depth  int
	Limit  int
	Labels []string
}

type graphNodeRow struct {
	Name      string
	Emotion   string
	Explained bool
	Degree    int
}

func parseGraphQueryOptions(c *gin.Context) graphQueryOptions {
	mode := strings.TrimSpace(strings.ToLower(c.Query("mode")))
	if mode != "focus" {
		mode = "overview"
	}

	center := strings.TrimSpace(c.Query("center"))
	if center == "" && mode == "focus" {
		mode = "overview"
	}

	depth := 1
	if mode == "overview" {
		depth = 0
	}
	if rawDepth := strings.TrimSpace(c.Query("depth")); rawDepth != "" {
		if parsedDepth, err := strconv.Atoi(rawDepth); err == nil {
			if parsedDepth < 0 {
				parsedDepth = 0
			}
			if parsedDepth > 2 {
				parsedDepth = 2
			}
			depth = parsedDepth
		}
	}

	limit := 300
	if rawLimit := strings.TrimSpace(c.Query("limit")); rawLimit != "" {
		if parsedLimit, err := strconv.Atoi(rawLimit); err == nil {
			if parsedLimit < 20 {
				parsedLimit = 20
			}
			if parsedLimit > 800 {
				parsedLimit = 800
			}
			limit = parsedLimit
		}
	}

	labels := parseGraphLabels(c.Query("labels"))

	return graphQueryOptions{
		Mode:   mode,
		Center: center,
		Depth:  depth,
		Limit:  limit,
		Labels: labels,
	}
}

func parseGraphLabels(raw string) []string {
	allowed := map[string]bool{
		"SYNONYM": true,
		"ANTONYM": true,
		"RELATED": true,
		"ANALOGY": true,
	}

	if strings.TrimSpace(raw) == "" {
		return []string{"SYNONYM", "ANTONYM", "RELATED", "ANALOGY"}
	}

	labels := make([]string, 0)
	seen := make(map[string]bool)
	for _, part := range strings.Split(raw, ",") {
		label := strings.ToUpper(strings.TrimSpace(part))
		if !allowed[label] || seen[label] {
			continue
		}
		seen[label] = true
		labels = append(labels, label)
	}

	if len(labels) == 0 {
		return []string{"SYNONYM", "ANTONYM", "RELATED", "ANALOGY"}
	}

	return labels
}

func loadGraphData(ctx context.Context, tx neo4j.ManagedTransaction, owner string, options graphQueryOptions) (models.GraphData, error) {
	if options.Mode == "focus" {
		return loadFocusedGraphData(ctx, tx, owner, options)
	}
	return loadOverviewGraphData(ctx, tx, owner, options)
}

func loadOverviewGraphData(ctx context.Context, tx neo4j.ManagedTransaction, owner string, options graphQueryOptions) (models.GraphData, error) {
	selectedNodes, err := fetchOverviewNodes(ctx, tx, owner, options.Limit, options.Labels)
	if err != nil {
		return models.GraphData{}, err
	}
	if len(selectedNodes) == 0 {
		return models.GraphData{Nodes: []models.GraphNode{}, Links: []models.GraphLink{}}, nil
	}

	names := make([]string, 0, len(selectedNodes))
	for _, node := range selectedNodes {
		names = append(names, node.Name)
	}

	links, err := fetchLinksWithinNames(ctx, tx, owner, names, options.Labels, options.Limit*4)
	if err != nil {
		return models.GraphData{}, err
	}

	return buildGraphData(selectedNodes, links), nil
}

func loadFocusedGraphData(ctx context.Context, tx neo4j.ManagedTransaction, owner string, options graphQueryOptions) (models.GraphData, error) {
	names, err := fetchFocusedNodeNames(ctx, tx, owner, options.Center, options.Depth, options.Limit, options.Labels)
	if err != nil {
		return models.GraphData{}, err
	}
	if len(names) == 0 {
		return models.GraphData{Nodes: []models.GraphNode{}, Links: []models.GraphLink{}}, nil
	}

	nodes, err := fetchNodesByNames(ctx, tx, owner, names)
	if err != nil {
		return models.GraphData{}, err
	}

	links, err := fetchLinksWithinNames(ctx, tx, owner, names, options.Labels, options.Limit*6)
	if err != nil {
		return models.GraphData{}, err
	}

	return buildGraphData(nodes, links), nil
}

func fetchOverviewNodes(ctx context.Context, tx neo4j.ManagedTransaction, owner string, limit int, labels []string) ([]graphNodeRow, error) {
	result, err := tx.Run(ctx,
		`MATCH (n:UserIdiom {owner: $owner})
		 OPTIONAL MATCH (n)-[r1]->(:UserIdiom {owner: $owner})
		 WHERE type(r1) IN $labels
		 WITH n, count(r1) AS outDegree
		 OPTIONAL MATCH (:UserIdiom {owner: $owner})-[r2]->(n)
		 WHERE type(r2) IN $labels
		 WITH n, outDegree, count(r2) AS inDegree
		 RETURN n.name AS name,
		        n.emotions AS emotion,
		        n.meaning IS NOT NULL AS explained,
		        outDegree + inDegree AS degree
		 ORDER BY degree DESC, name ASC
		 LIMIT $limit`,
		map[string]any{
			"owner":  owner,
			"labels": labels,
			"limit":  limit,
		},
	)
	if err != nil {
		return nil, err
	}

	rows := make([]graphNodeRow, 0)
	for result.Next(ctx) {
		record := result.Record()
		name, _ := record.Get("name")
		nameStr := stringValue(name)
		if nameStr == "" {
			continue
		}

		emotion, _ := record.Get("emotion")
		explained, _ := record.Get("explained")
		degree, _ := record.Get("degree")

		rows = append(rows, graphNodeRow{
			Name:      nameStr,
			Emotion:   stringValue(emotion),
			Explained: boolValue(explained),
			Degree:    intValue(degree, 0),
		})
	}

	return rows, result.Err()
}

func fetchFocusedNodeNames(ctx context.Context, tx neo4j.ManagedTransaction, owner string, center string, depth int, limit int, labels []string) ([]string, error) {
	if center == "" {
		return nil, nil
	}

	centerNodes, err := fetchNodesByNames(ctx, tx, owner, []string{center})
	if err != nil {
		return nil, err
	}
	if len(centerNodes) == 0 {
		return nil, nil
	}

	seen := map[string]bool{center: true}
	orderedNames := []string{center}
	if depth <= 0 {
		return orderedNames, nil
	}

	frontier := []string{center}
	for hop := 0; hop < depth; hop++ {
		if len(frontier) == 0 || len(orderedNames) >= limit {
			break
		}

		res, err := tx.Run(ctx,
			`MATCH (n:UserIdiom {owner: $owner})-[r]-(neighbor:UserIdiom {owner: $owner})
			 WHERE n.name IN $frontier AND type(r) IN $labels
			 RETURN DISTINCT neighbor.name AS name
			 ORDER BY name ASC
			 LIMIT $limit`,
			map[string]any{
				"owner":    owner,
				"frontier": frontier,
				"labels":   labels,
				"limit":    limit * 4,
			},
		)
		if err != nil {
			return nil, err
		}

		nextFrontier := make([]string, 0)
		for res.Next(ctx) {
			nameValue, _ := res.Record().Get("name")
			name := stringValue(nameValue)
			if name == "" || seen[name] {
				continue
			}

			seen[name] = true
			orderedNames = append(orderedNames, name)
			nextFrontier = append(nextFrontier, name)
			if len(orderedNames) >= limit {
				break
			}
		}
		if err := res.Err(); err != nil {
			return nil, err
		}

		frontier = nextFrontier
	}

	return orderedNames, nil
}

func fetchNodesByNames(ctx context.Context, tx neo4j.ManagedTransaction, owner string, names []string) ([]graphNodeRow, error) {
	if len(names) == 0 {
		return []graphNodeRow{}, nil
	}

	res, err := tx.Run(ctx,
		`MATCH (n:UserIdiom {owner: $owner})
		 WHERE n.name IN $names
		 RETURN n.name AS name, n.emotions AS emotion, n.meaning IS NOT NULL AS explained
		 ORDER BY name ASC`,
		map[string]any{
			"owner": owner,
			"names": names,
		},
	)
	if err != nil {
		return nil, err
	}

	rows := make([]graphNodeRow, 0, len(names))
	for res.Next(ctx) {
		record := res.Record()
		name, _ := record.Get("name")
		nameStr := stringValue(name)
		if nameStr == "" {
			continue
		}

		emotion, _ := record.Get("emotion")
		explained, _ := record.Get("explained")

		rows = append(rows, graphNodeRow{
			Name:      nameStr,
			Emotion:   stringValue(emotion),
			Explained: boolValue(explained),
		})
	}

	return rows, res.Err()
}

func fetchLinksWithinNames(ctx context.Context, tx neo4j.ManagedTransaction, owner string, names []string, labels []string, limit int) ([]models.GraphLink, error) {
	if len(names) == 0 {
		return []models.GraphLink{}, nil
	}

	res, err := tx.Run(ctx,
		`MATCH (s:UserIdiom {owner: $owner})-[r]->(t:UserIdiom {owner: $owner})
		 WHERE s.name IN $names
		   AND t.name IN $names
		   AND type(r) IN $labels
		 RETURN s.name AS source,
		        t.name AS target,
		        type(r) AS label,
		        r.strength AS strength,
		        r.similarityType AS similarityType,
		        r.difference AS difference,
		        r.sourceExample AS sourceExample,
		        r.targetExample AS targetExample
		 LIMIT $limit`,
		map[string]any{
			"owner":  owner,
			"names":  names,
			"labels": labels,
			"limit":  limit,
		},
	)
	if err != nil {
		return nil, err
	}

	links := make([]models.GraphLink, 0)
	for res.Next(ctx) {
		record := res.Record()
		source, _ := record.Get("source")
		target, _ := record.Get("target")
		label, _ := record.Get("label")
		strength, _ := record.Get("strength")
		similarityType, _ := record.Get("similarityType")
		difference, _ := record.Get("difference")
		sourceExample, _ := record.Get("sourceExample")
		targetExample, _ := record.Get("targetExample")

		sourceStr := stringValue(source)
		targetStr := stringValue(target)
		if sourceStr == "" || targetStr == "" {
			continue
		}

		links = append(links, models.GraphLink{
			Source:         sourceStr,
			Target:         targetStr,
			Label:          stringValue(label),
			Strength:       float64Value(strength, 0.5),
			SimilarityType: stringValue(similarityType),
			Difference:     stringValue(difference),
			SourceExample:  stringValue(sourceExample),
			TargetExample:  stringValue(targetExample),
		})
	}

	return links, res.Err()
}

func buildGraphData(nodeRows []graphNodeRow, links []models.GraphLink) models.GraphData {
	graph := models.GraphData{
		Nodes: []models.GraphNode{},
		Links: links,
	}

	degreeMap := make(map[string]int)
	for _, link := range links {
		degreeMap[link.Source]++
		degreeMap[link.Target]++
	}

	for _, row := range nodeRows {
		graph.Nodes = append(graph.Nodes, models.GraphNode{
			ID:         row.Name,
			Label:      row.Name,
			Type:       "Idiom",
			Emotion:    row.Emotion,
			HasMeaning: row.Explained,
			Degree:     maxInt(row.Degree, degreeMap[row.Name]),
		})
	}

	return graph
}

func maxInt(left int, right int) int {
	if left > right {
		return left
	}
	return right
}

func GetIdiomDetail(c *gin.Context) {
	user, ok := currentUserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Name is required"})
		return
	}

	if database.Driver == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Neo4j is not connected"})
		return
	}

	ctx := context.Background()
	session := database.Driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		// Fetch idiom properties
		res, err := tx.Run(ctx,
			"MATCH (i:UserIdiom {owner: $owner, name: $name}) RETURN i.meaning AS meaning, i.emotions AS emotions, i.examples AS examples",
			map[string]any{"owner": user.Username, "name": name})
		if err != nil {
			return nil, err
		}

		if !res.Next(ctx) {
			return nil, nil // Not found
		}

		record := res.Record()
		meaning, _ := record.Get("meaning")
		emotions, _ := record.Get("emotions")
		examples, _ := record.Get("examples")

		idiomRes := models.IdiomExtractionResult{
			Idiom:        name,
			Meaning:      "",
			Emotions:     "",
			Synonyms:     []models.RelationshipDetail{},
			Antonyms:     []models.RelationshipDetail{},
			Examples:     []models.UsageExample{},
			HasAIExplore: meaning != nil, // Only considered explored if it has a meaning
		}

		if meaning != nil {
			idiomRes.Meaning = stringValue(meaning)
		}
		if emotions != nil {
			idiomRes.Emotions = stringValue(emotions)
		}
		if examples != nil {
			switch value := examples.(type) {
			case string:
				if value != "" && value != "null" {
					if err := json.Unmarshal([]byte(value), &idiomRes.Examples); err != nil {
						return nil, err
					}
				}
			case []byte:
				if len(value) > 0 && string(value) != "null" {
					if err := json.Unmarshal(value, &idiomRes.Examples); err != nil {
						return nil, err
					}
				}
			}
		}

		// Fetch Synonyms
		synRes, err := tx.Run(ctx,
			`MATCH (i:UserIdiom {owner: $owner, name: $name})-[r:SYNONYM]->(s:UserIdiom {owner: $owner})
			 RETURN s.name AS name, r.strength AS strength, s.meaning IS NOT NULL AS hasAIExplore,
			        r.similarityType AS similarityType, r.difference AS difference,
			        r.sourceExample AS sourceExample, r.targetExample AS targetExample`,
			map[string]any{"owner": user.Username, "name": name})
		if err == nil {
			for synRes.Next(ctx) {
				rec := synRes.Record()
				n, _ := rec.Get("name")
				s, _ := rec.Get("strength")
				h, _ := rec.Get("hasAIExplore")
				similarityType, _ := rec.Get("similarityType")
				difference, _ := rec.Get("difference")
				sourceExample, _ := rec.Get("sourceExample")
				targetExample, _ := rec.Get("targetExample")
				name := stringValue(n)
				if name == "" {
					continue
				}
				idiomRes.Synonyms = append(idiomRes.Synonyms, models.RelationshipDetail{
					Name:           name,
					Strength:       float64Value(s, 0),
					SimilarityType: stringValue(similarityType),
					Difference:     stringValue(difference),
					SourceExample:  stringValue(sourceExample),
					TargetExample:  stringValue(targetExample),
					HasAIExplore:   boolValue(h),
				})
			}
		}

		// Fetch Antonyms
		antRes, err := tx.Run(ctx,
			`MATCH (i:UserIdiom {owner: $owner, name: $name})-[r:ANTONYM]->(a:UserIdiom {owner: $owner})
			 RETURN a.name AS name, r.strength AS strength, a.meaning IS NOT NULL AS hasAIExplore,
			        r.similarityType AS similarityType, r.difference AS difference,
			        r.sourceExample AS sourceExample, r.targetExample AS targetExample`,
			map[string]any{"owner": user.Username, "name": name})
		if err == nil {
			for antRes.Next(ctx) {
				rec := antRes.Record()
				n, _ := rec.Get("name")
				s, _ := rec.Get("strength")
				h, _ := rec.Get("hasAIExplore")
				similarityType, _ := rec.Get("similarityType")
				difference, _ := rec.Get("difference")
				sourceExample, _ := rec.Get("sourceExample")
				targetExample, _ := rec.Get("targetExample")
				name := stringValue(n)
				if name == "" {
					continue
				}
				idiomRes.Antonyms = append(idiomRes.Antonyms, models.RelationshipDetail{
					Name:           name,
					Strength:       float64Value(s, 0),
					SimilarityType: stringValue(similarityType),
					Difference:     stringValue(difference),
					SourceExample:  stringValue(sourceExample),
					TargetExample:  stringValue(targetExample),
					HasAIExplore:   boolValue(h),
				})
			}
		}

		return idiomRes, nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query idiom detail: " + err.Error()})
		return
	}

	if result == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Idiom not found in database"})
		return
	}

	if idiomRes, ok := result.(models.IdiomExtractionResult); ok {
		idiomRes.Examples = services.EnsureAuthoritativeExamples(c.Request.Context(), idiomRes.Idiom, idiomRes.Meaning, idiomRes.Examples)
		result = idiomRes
	}

	c.JSON(http.StatusOK, result)
}

func AssociateIdioms(c *gin.Context) {
	user, ok := currentUserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req models.AssociateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Label == "" {
		req.Label = "RELATED"
	}

	// Basic validation for relationship label to prevent Cypher injection
	allowedLabels := map[string]bool{
		"SYNONYM": true,
		"ANTONYM": true,
		"RELATED": true,
		"ANALOGY": true,
	}
	if !allowedLabels[req.Label] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid relationship label. Allowed: SYNONYM, ANTONYM, RELATED, ANALOGY"})
		return
	}

	if req.Strength == 0 {
		req.Strength = 1.0
	}

	if database.Driver != nil {
		ctx := context.Background()
		session := database.Driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
		defer session.Close(ctx)

		_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
			_, err := tx.Run(ctx,
				`MATCH (s:UserIdiom {owner: $owner, name: $source})
				 MATCH (t:UserIdiom {owner: $owner, name: $target})
				 MERGE (s)-[r:`+req.Label+`]->(t)
				 SET r.strength = $strength,
				     r.similarityType = $similarityType,
				     r.difference = $difference,
				     r.sourceExample = $sourceExample,
				     r.targetExample = $targetExample
				 RETURN r`,
				map[string]any{
					"owner":          user.Username,
					"source":         req.Source,
					"target":         req.Target,
					"strength":       req.Strength,
					"similarityType": req.SimilarityType,
					"difference":     req.Difference,
					"sourceExample":  req.SourceExample,
					"targetExample":  req.TargetExample,
				})
			return nil, err
		})

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create association: " + err.Error()})
			return
		}
	} else {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Neo4j is not connected"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Association created successfully!"})
}

func DissociateIdioms(c *gin.Context) {
	user, ok := currentUserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req models.DissociateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validation
	allowedLabels := map[string]bool{
		"SYNONYM": true,
		"ANTONYM": true,
		"RELATED": true,
		"ANALOGY": true,
	}
	if !allowedLabels[req.Label] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid relationship label"})
		return
	}

	if database.Driver != nil {
		ctx := context.Background()
		session := database.Driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
		defer session.Close(ctx)

		_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
			_, err := tx.Run(ctx,
				`MATCH (s:UserIdiom {owner: $owner, name: $source})-[r:`+req.Label+`]->(t:UserIdiom {owner: $owner, name: $target})
				 DELETE r`,
				map[string]any{
					"owner":  user.Username,
					"source": req.Source,
					"target": req.Target,
				})
			return nil, err
		})

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete association: " + err.Error()})
			return
		}
	} else {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Neo4j is not connected"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Association removed successfully!"})
}

func DeleteIdiom(c *gin.Context) {
	user, ok := currentUserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Name is required"})
		return
	}

	if database.Driver == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Neo4j is not connected"})
		return
	}

	ctx := context.Background()
	session := database.Driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	defer session.Close(ctx)

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		// Delete only the current user's idiom node and its relationships.
		_, err := tx.Run(ctx,
			"MATCH (i:UserIdiom {owner: $owner, name: $name}) DETACH DELETE i",
			map[string]any{
				"owner": user.Username,
				"name":  name,
			})
		return nil, err
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete from Neo4j: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Deleted successfully!"})
}

func ParseImage(c *gin.Context) {
	user, ok := currentUserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req models.ImageParseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Uses AI quota mechanism (same as text search).
	if err := ensureUserCanUseAISearch(c.Request.Context(), user.Username); err != nil {
		if errors.Is(err, errAISearchBalanceExhausted) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify AI search balance"})
		return
	}

	result, err := services.ExtractIdiomsFromImage(c.Request.Context(), req.ImageBase64)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to extract from image: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

