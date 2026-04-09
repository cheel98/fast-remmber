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
	log.Println("Connected to Neo4j successfully")
	return nil
}

func Close() {
	if Driver != nil {
		Driver.Close(context.Background())
	}
}
