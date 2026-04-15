package handlers

import (
	"context"
	"encoding/json"
	"net/http"

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

	ctx := context.Background()
	session := database.Driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		res, err := tx.Run(ctx,
			`MATCH (n:UserIdiom {owner: $owner})-[r]->(m:UserIdiom {owner: $owner})
			 WHERE n.name IS NOT NULL AND m.name IS NOT NULL
			 RETURN n.name AS source, n.emotions AS sEmotion, n.meaning IS NOT NULL AS sExplained,
			        m.name AS target, m.emotions AS tEmotion, m.meaning IS NOT NULL AS tExplained,
			        type(r) AS label, r.strength AS strength, r.similarityType AS similarityType,
			        r.difference AS difference, r.sourceExample AS sourceExample, r.targetExample AS targetExample LIMIT 200`,
			map[string]any{"owner": user.Username})
		if err != nil {
			return nil, err
		}

		graph := models.GraphData{
			Nodes: []models.GraphNode{},
			Links: []models.GraphLink{},
		}

		nodeMap := make(map[string]*models.GraphNode)

		for res.Next(ctx) {
			record := res.Record()
			source, _ := record.Get("source")
			sEmotion, _ := record.Get("sEmotion")
			sExplained, _ := record.Get("sExplained")
			target, _ := record.Get("target")
			tEmotion, _ := record.Get("tEmotion")
			tExplained, _ := record.Get("tExplained")
			label, _ := record.Get("label")
			strength, _ := record.Get("strength")
			similarityType, _ := record.Get("similarityType")
			difference, _ := record.Get("difference")
			sourceExample, _ := record.Get("sourceExample")
			targetExample, _ := record.Get("targetExample")

			srcStr := stringValue(source)
			tgtStr := stringValue(target)
			if srcStr == "" || tgtStr == "" {
				continue
			}

			// Helper to add or update node
			updateNode := func(id string, emotion any, explained any) {
				emoStr := stringValue(emotion)
				isExplained := boolValue(explained)
				if node, exists := nodeMap[id]; !exists {
					nodeMap[id] = &models.GraphNode{ID: id, Label: id, Type: "Idiom", Emotion: emoStr, HasMeaning: isExplained}
				} else {
					if node.Emotion == "" && emoStr != "" {
						node.Emotion = emoStr
					}
					// If we find evidence that it's explained, update it
					if isExplained {
						node.HasMeaning = true
					}
				}
			}

			updateNode(srcStr, sEmotion, sExplained)
			updateNode(tgtStr, tEmotion, tExplained)

			labelStr := stringValue(label)
			if labelStr == "" {
				labelStr = "RELATED"
			}

			graph.Links = append(graph.Links, models.GraphLink{
				Source:         srcStr,
				Target:         tgtStr,
				Label:          labelStr,
				Strength:       float64Value(strength, 0.5),
				SimilarityType: stringValue(similarityType),
				Difference:     stringValue(difference),
				SourceExample:  stringValue(sourceExample),
				TargetExample:  stringValue(targetExample),
			})
		}

		// Transfer nodes from map to slice
		for _, node := range nodeMap {
			graph.Nodes = append(graph.Nodes, *node)
		}
		return graph, nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query graph: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
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
