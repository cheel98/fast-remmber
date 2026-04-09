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
				"MATCH (i:Idiom) WHERE i.name IN $names AND i.meaning IS NOT NULL RETURN i.name",
				map[string]any{"names": names})
			if err != nil {
				return nil, err
			}

			meaningMap := make(map[string]bool)
			for res.Next(ctx) {
				n, _ := res.Record().Get("i.name")
				meaningMap[n.(string)] = true
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

	c.JSON(http.StatusOK, result)
}

func SaveIdiom(c *gin.Context) {
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
			// Create main idiom node
			_, err := tx.Run(ctx,
				"MERGE (i:Idiom {name: $name}) SET i.meaning = $meaning, i.emotions = $emotions, i.examples = $examples",
				map[string]any{"name": body.Idiom, "meaning": body.Meaning, "emotions": body.Emotions, "examples": string(examplesJSON)})
			if err != nil {
				return nil, err
			}

			// Create synonym relationships
			for _, syn := range body.Synonyms {
				_, err = tx.Run(ctx,
					`MERGE (i:Idiom {name: $idiom})
					 MERGE (s:Idiom {name: $syn})
					 MERGE (i)-[r:SYNONYM]->(s)
					 SET r.strength = $strength`,
					map[string]any{"idiom": body.Idiom, "syn": syn.Name, "strength": syn.Strength})
				if err != nil {
					return nil, err
				}
			}

			// Create antonym relationships
			for _, ant := range body.Antonyms {
				_, err = tx.Run(ctx,
					`MERGE (i:Idiom {name: $idiom})
					 MERGE (a:Idiom {name: $ant})
					 MERGE (i)-[r:ANTONYM]->(a)
					 SET r.strength = $strength`,
					map[string]any{"idiom": body.Idiom, "ant": ant.Name, "strength": ant.Strength})
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
			`MATCH (n)-[r]->(m) 
			 RETURN n.name AS source, n.emotions AS sEmotion, n.meaning IS NOT NULL AS sExplained,
			        m.name AS target, m.emotions AS tEmotion, m.meaning IS NOT NULL AS tExplained,
			        type(r) AS label, r.strength AS strength LIMIT 200`,
			nil)
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

			srcStr := source.(string)
			tgtStr := target.(string)

			// Helper to add or update node
			updateNode := func(id string, emotion any, explained any) {
				emoStr := ""
				if emotion != nil {
					emoStr = emotion.(string)
				}
				isExplained := false
				if explained != nil {
					isExplained = explained.(bool)
				}
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

			strengthVal := 0.5 // Default if not present
			if strength != nil {
				strengthVal = strength.(float64)
			}

			graph.Links = append(graph.Links, models.GraphLink{
				Source:   srcStr,
				Target:   tgtStr,
				Label:    label.(string),
				Strength: strengthVal,
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
			"MATCH (i:Idiom {name: $name}) RETURN i.meaning AS meaning, i.emotions AS emotions, i.examples AS examples",
			map[string]any{"name": name})
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
			idiomRes.Meaning = meaning.(string)
		}
		if emotions != nil {
			idiomRes.Emotions = emotions.(string)
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
			"MATCH (i:Idiom {name: $name})-[r:SYNONYM]->(s:Idiom) RETURN s.name AS name, r.strength AS strength, s.meaning IS NOT NULL AS hasAIExplore",
			map[string]any{"name": name})
		if err == nil {
			for synRes.Next(ctx) {
				rec := synRes.Record()
				n, _ := rec.Get("name")
				s, _ := rec.Get("strength")
				h, _ := rec.Get("hasAIExplore")
				idiomRes.Synonyms = append(idiomRes.Synonyms, models.RelationshipDetail{
					Name:         n.(string),
					Strength:     s.(float64),
					HasAIExplore: h.(bool),
				})
			}
		}

		// Fetch Antonyms
		antRes, err := tx.Run(ctx,
			"MATCH (i:Idiom {name: $name})-[r:ANTONYM]->(a:Idiom) RETURN a.name AS name, r.strength AS strength, a.meaning IS NOT NULL AS hasAIExplore",
			map[string]any{"name": name})
		if err == nil {
			for antRes.Next(ctx) {
				rec := antRes.Record()
				n, _ := rec.Get("name")
				s, _ := rec.Get("strength")
				h, _ := rec.Get("hasAIExplore")
				idiomRes.Antonyms = append(idiomRes.Antonyms, models.RelationshipDetail{
					Name:         n.(string),
					Strength:     s.(float64),
					HasAIExplore: h.(bool),
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
		idiomRes.Examples = services.EnsureAuthoritativeExamples(c.Request.Context(), idiomRes.Idiom, idiomRes.Examples)
		result = idiomRes
	}

	c.JSON(http.StatusOK, result)
}

func AssociateIdioms(c *gin.Context) {
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
				`MATCH (s:Idiom {name: $source})
				 MATCH (t:Idiom {name: $target})
				 MERGE (s)-[r:`+req.Label+`]->(t)
				 SET r.strength = $strength
				 RETURN r`,
				map[string]any{
					"source":   req.Source,
					"target":   req.Target,
					"strength": req.Strength,
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
				`MATCH (s:Idiom {name: $source})-[r:`+req.Label+`]->(t:Idiom {name: $target})
				 DELETE r`,
				map[string]any{
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
		// Use DETACH DELETE to remove the node and its relationships
		_, err := tx.Run(ctx,
			"MATCH (i:Idiom {name: $name}) DETACH DELETE i",
			map[string]any{"name": name})
		return nil, err
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete from Neo4j: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Deleted successfully!"})
}
