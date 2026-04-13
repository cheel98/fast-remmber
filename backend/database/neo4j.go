package database

import (
	"context"
	"log"
	"os"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

var Driver neo4j.DriverWithContext

func InitNeo4j() error {
	uri := os.Getenv("NEO4J_URI")
	if uri == "" {
		uri = "bolt://localhost:7687" // default
	}
	user := os.Getenv("NEO4J_USER")
	password := os.Getenv("NEO4J_PASSWORD")

	ctx := context.Background()
	driver, err := neo4j.NewDriverWithContext(uri, neo4j.BasicAuth(user, password, ""))
	if err != nil {
		return err
	}

	err = driver.VerifyConnectivity(ctx)
	if err != nil {
		return err
	}

	Driver = driver

	if err := ensureConstraints(ctx); err != nil {
		return err
	}

	log.Println("Connected to Neo4j successfully")
	return nil
}

func Close() {
	if Driver != nil {
		Driver.Close(context.Background())
	}
}

func ensureConstraints(ctx context.Context) error {
	if Driver == nil {
		return nil
	}

	session := Driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	defer session.Close(ctx)

	queries := []string{
		"CREATE CONSTRAINT idiom_name_unique IF NOT EXISTS FOR (i:Idiom) REQUIRE i.name IS UNIQUE",
		"CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
		"CREATE CONSTRAINT user_username_unique IF NOT EXISTS FOR (u:User) REQUIRE u.username IS UNIQUE",
		"CREATE CONSTRAINT user_idiom_owner_name_unique IF NOT EXISTS FOR (i:UserIdiom) REQUIRE (i.owner, i.name) IS UNIQUE",
		"CREATE CONSTRAINT discovery_id_unique IF NOT EXISTS FOR (d:Discovery) REQUIRE d.id IS UNIQUE",
	}

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		for _, query := range queries {
			if _, err := tx.Run(ctx, query, nil); err != nil {
				return nil, err
			}
		}
		return nil, nil
	})

	return err
}
