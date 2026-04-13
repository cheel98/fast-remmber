package handlers

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"fast-remmber-backend/database"
	"fast-remmber-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"golang.org/x/crypto/bcrypt"
)

const currentUserContextKey = "currentUser"

type authTokenClaims struct {
	Username string `json:"username"`
	Exp      int64  `json:"exp"`
}

type userRecord struct {
	ID           string
	Username     string
	PasswordHash string
	CreatedAt    string
}

func RegisterUser(c *gin.Context) {
	if database.Driver == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Neo4j is not connected"})
		return
	}

	var req models.AuthCredentialsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	username := normalizeUsername(req.Username)
	if err := validateCredentials(username, req.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	user := models.AuthUser{
		ID:        newID("usr"),
		Username:  username,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}

	ctx := context.Background()
	session := database.Driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	defer session.Close(ctx)

	_, err = session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		existingRes, err := tx.Run(ctx,
			`MATCH (u:User {username: $username})
			 RETURN u.id AS id
			 LIMIT 1`,
			map[string]any{"username": user.Username})
		if err != nil {
			return nil, err
		}
		if existingRes.Next(ctx) {
			return nil, errors.New("username already exists")
		}

		res, err := tx.Run(ctx,
			`CREATE (u:User {
			 id: $id,
			 username: $username,
			 passwordHash: $passwordHash,
			 createdAt: $createdAt
			 })
			 RETURN u.id AS id, u.createdAt AS createdAt`,
			map[string]any{
				"id":           user.ID,
				"username":     user.Username,
				"passwordHash": string(passwordHash),
				"createdAt":    user.CreatedAt,
			})
		if err != nil {
			return nil, err
		}

		if !res.Next(ctx) {
			return nil, errors.New("failed to create user")
		}

		record := res.Record()
		id, _ := record.Get("id")
		createdAt, _ := record.Get("createdAt")

		if id != nil {
			user.ID = id.(string)
		}
		if createdAt != nil {
			user.CreatedAt = createdAt.(string)
		}

		return nil, nil
	})
	if err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "username already exists") ||
			strings.Contains(err.Error(), "ConstraintValidationFailed") ||
			strings.Contains(err.Error(), "user_username_unique") {
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	token, err := signAuthToken(user.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to issue auth token"})
		return
	}

	c.JSON(http.StatusCreated, models.AuthResponse{Token: token, User: user})
}

func LoginUser(c *gin.Context) {
	if database.Driver == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Neo4j is not connected"})
		return
	}

	var req models.AuthCredentialsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	username := normalizeUsername(req.Username)
	record, err := findUserByUsername(c.Request.Context(), username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user"})
		return
	}
	if record == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(record.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
		return
	}

	token, err := signAuthToken(record.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to issue auth token"})
		return
	}

	c.JSON(http.StatusOK, models.AuthResponse{
		Token: token,
		User: models.AuthUser{
			ID:        record.ID,
			Username:  record.Username,
			CreatedAt: record.CreatedAt,
		},
	})
}

func GetCurrentUser(c *gin.Context) {
	user, ok := currentUserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
		if !strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			return
		}

		token := strings.TrimSpace(authHeader[len("Bearer "):])
		username, err := verifyAuthToken(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		record, err := findUserByUsername(c.Request.Context(), username)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate user"})
			return
		}
		if record == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			return
		}

		c.Set(currentUserContextKey, models.AuthUser{
			ID:        record.ID,
			Username:  record.Username,
			CreatedAt: record.CreatedAt,
		})
		c.Next()
	}
}

func currentUserFromContext(c *gin.Context) (models.AuthUser, bool) {
	value, ok := c.Get(currentUserContextKey)
	if !ok {
		return models.AuthUser{}, false
	}

	user, ok := value.(models.AuthUser)
	return user, ok
}

func findUserByUsername(ctx context.Context, username string) (*userRecord, error) {
	if database.Driver == nil {
		return nil, errors.New("neo4j is not connected")
	}

	session := database.Driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		res, err := tx.Run(ctx,
			`MATCH (u:User {username: $username})
			 RETURN u.id AS id, u.username AS username, u.passwordHash AS passwordHash, u.createdAt AS createdAt`,
			map[string]any{"username": username})
		if err != nil {
			return nil, err
		}
		if !res.Next(ctx) {
			return nil, nil
		}

		record := res.Record()
		id, _ := record.Get("id")
		foundUsername, _ := record.Get("username")
		passwordHash, _ := record.Get("passwordHash")
		createdAt, _ := record.Get("createdAt")

		return &userRecord{
			ID:           stringValue(id),
			Username:     stringValue(foundUsername),
			PasswordHash: stringValue(passwordHash),
			CreatedAt:    stringValue(createdAt),
		}, nil
	})
	if err != nil {
		return nil, err
	}
	if result == nil {
		return nil, nil
	}

	return result.(*userRecord), nil
}

func validateCredentials(username string, password string) error {
	if strings.TrimSpace(username) == "" {
		return errors.New("username is required")
	}
	return nil
}

func normalizeUsername(username string) string {
	return strings.ToLower(strings.TrimSpace(username))
}

func signAuthToken(username string) (string, error) {
	claims := authTokenClaims{
		Username: username,
		Exp:      time.Now().UTC().Add(7 * 24 * time.Hour).Unix(),
	}

	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	payloadPart := base64.RawURLEncoding.EncodeToString(payload)
	signaturePart := signTokenPayload(payloadPart)

	return payloadPart + "." + signaturePart, nil
}

func verifyAuthToken(token string) (string, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return "", errors.New("invalid token format")
	}

	expectedSignature := signTokenPayload(parts[0])
	if !hmac.Equal([]byte(parts[1]), []byte(expectedSignature)) {
		return "", errors.New("invalid token signature")
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", err
	}

	var claims authTokenClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return "", err
	}

	if claims.Username == "" || claims.Exp < time.Now().UTC().Unix() {
		return "", errors.New("token expired")
	}

	return claims.Username, nil
}

func signTokenPayload(payload string) string {
	mac := hmac.New(sha256.New, authSecret())
	mac.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func authSecret() []byte {
	secret := os.Getenv("APP_SECRET")
	if strings.TrimSpace(secret) == "" {
		secret = "fast-remmber-dev-secret"
	}
	return []byte(secret)
}

func newID(prefix string) string {
	randomBytes := make([]byte, 8)
	if _, err := rand.Read(randomBytes); err != nil {
		now := time.Now().UTC().UnixNano()
		return prefix + "_" + strconv.FormatInt(now, 10)
	}
	return prefix + "_" + hex.EncodeToString(randomBytes)
}

func stringValue(value any) string {
	if value == nil {
		return ""
	}
	if stringValue, ok := value.(string); ok {
		return stringValue
	}
	return ""
}

func boolValue(value any) bool {
	if value == nil {
		return false
	}
	if boolValue, ok := value.(bool); ok {
		return boolValue
	}
	return false
}

func float64Value(value any, defaultValue float64) float64 {
	switch typedValue := value.(type) {
	case float64:
		return typedValue
	case float32:
		return float64(typedValue)
	case int:
		return float64(typedValue)
	case int64:
		return float64(typedValue)
	case int32:
		return float64(typedValue)
	default:
		return defaultValue
	}
}
