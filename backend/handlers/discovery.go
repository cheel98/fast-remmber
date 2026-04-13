package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"fast-remmber-backend/database"
	"fast-remmber-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

func ListDiscoveries(c *gin.Context) {
	user, ok := currentUserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	if database.Driver == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Neo4j is not connected"})
		return
	}

	limit := 20
	if rawLimit := c.DefaultQuery("limit", "20"); rawLimit != "" {
		if parsedLimit, err := strconv.Atoi(rawLimit); err == nil && parsedLimit > 0 && parsedLimit <= 100 {
			limit = parsedLimit
		}
	}

	ctx := c.Request.Context()
	session := database.Driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		res, err := tx.Run(ctx,
			`MATCH (u:User {username: $username})-[:MADE_DISCOVERY]->(d:Discovery)
			 RETURN d.id AS id, d.query AS query, d.createdAt AS createdAt, d.result AS result
			 ORDER BY d.createdAt DESC
			 LIMIT $limit`,
			map[string]any{
				"username": user.Username,
				"limit":    limit,
			})
		if err != nil {
			return nil, err
		}

		records := make([]models.DiscoveryRecord, 0, limit)
		for res.Next(ctx) {
			record := res.Record()
			resultPayload := stringValueFromRecord(record, "result")

			discovery := models.DiscoveryRecord{
				ID:        stringValueFromRecord(record, "id"),
				Query:     stringValueFromRecord(record, "query"),
				CreatedAt: stringValueFromRecord(record, "createdAt"),
				Result:    models.IdiomExtractionResult{},
			}

			if resultPayload != "" {
				if err := json.Unmarshal([]byte(resultPayload), &discovery.Result); err != nil {
					return nil, err
				}
			}

			records = append(records, discovery)
		}

		return records, nil
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch discovery history: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"records": result})
}

func saveDiscoveryRecord(ctx context.Context, username string, query string, analysisResult models.IdiomExtractionResult) error {
	if database.Driver == nil {
		return nil
	}

	resultJSON, err := json.Marshal(analysisResult)
	if err != nil {
		return err
	}

	session := database.Driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	defer session.Close(ctx)

	createdAt := time.Now().UTC().Format(time.RFC3339)
	writeResult, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		res, err := tx.Run(ctx,
			`MATCH (u:User {username: $username})
			 WITH u
			 CREATE (d:Discovery {
			 	id: $id,
			 	query: $query,
			 	createdAt: $createdAt,
			 	result: $result,
			 	idiom: $idiom,
			 	meaning: $meaning,
			 	emotions: $emotions
			 })
			 CREATE (u)-[:MADE_DISCOVERY]->(d)
			 RETURN d.id AS id`,
			map[string]any{
				"id":        newID("dis"),
				"username":  username,
				"query":     query,
				"createdAt": createdAt,
				"result":    string(resultJSON),
				"idiom":     analysisResult.Idiom,
				"meaning":   analysisResult.Meaning,
				"emotions":  analysisResult.Emotions,
			})
		if err != nil {
			return nil, err
		}
		if !res.Next(ctx) {
			return nil, errors.New("user not found for discovery record")
		}

		return stringValueFromRecord(res.Record(), "id"), nil
	})
	if err != nil {
		return err
	}
	if writeResult == nil {
		return errors.New("discovery record was not created")
	}

	return nil
}

func stringValueFromRecord(record *neo4j.Record, key string) string {
	value, _ := record.Get(key)
	return stringValue(value)
}
