package main

import (
	"log"
	
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"fast-remmber-backend/database"
	"fast-remmber-backend/handlers"
)

func main() {
	// Load .env if it exists
	_ = godotenv.Load()

	// Initialize Neo4j
	if err := database.InitNeo4j(); err != nil {
		log.Printf("Warning: neo4j init failed: %v", err)
	} else {
		defer database.Close()
	}

	r := gin.Default()

	// Config CORS
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"*"} // Allow Next.js during dev, restrict in prod
	r.Use(cors.New(config))

	// Routes
	api := r.Group("/api")
	{
		api.POST("/analyze", handlers.AnalyzeIdiom)
		api.POST("/save", handlers.SaveIdiom)
		api.POST("/associate", handlers.AssociateIdioms)
		api.POST("/dissociate", handlers.DissociateIdioms)
		api.GET("/graph", handlers.GetIdiomGraph)
		api.GET("/idiom/:name", handlers.GetIdiomDetail)
		api.DELETE("/idiom/:name", handlers.DeleteIdiom)
	}

	log.Println("Starting server on :8080")
	r.Run(":8080")
}
