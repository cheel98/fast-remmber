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
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	r.Use(cors.New(config))

	// Routes
	api := r.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/register", handlers.RegisterUser)
			auth.POST("/login", handlers.LoginUser)
		}

		protected := api.Group("")
		protected.Use(handlers.AuthMiddleware())
		{
			protected.GET("/auth/me", handlers.GetCurrentUser)
			protected.GET("/discoveries", handlers.ListDiscoveries)
			protected.GET("/graph", handlers.GetIdiomGraph)
			protected.GET("/idiom/:name", handlers.GetIdiomDetail)
			protected.POST("/analyze", handlers.AnalyzeIdiom)
			protected.POST("/analyze/image", handlers.ParseImage)
			protected.POST("/save", handlers.SaveIdiom)
			protected.POST("/associate", handlers.AssociateIdioms)
			protected.POST("/dissociate", handlers.DissociateIdioms)
			protected.DELETE("/idiom/:name", handlers.DeleteIdiom)
		}
	}

	log.Println("Starting server on :8080")
	r.Run(":8080")
}
