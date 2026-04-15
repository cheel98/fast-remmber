package models

type AuthCredentialsRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password"`
}

type AuthUserStats struct {
	DiscoveryCount      int  `json:"discoveryCount"`
	AISearchesUsed      int  `json:"aiSearchesUsed"`
	AISearchesLimit     *int `json:"aiSearchesLimit"`
	AISearchesRemaining *int `json:"aiSearchesRemaining"`
	UnlimitedAISearches bool `json:"unlimitedAISearches"`
}

type AuthUser struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	CreatedAt string `json:"createdAt"`
	Stats     AuthUserStats `json:"stats"`
}

type AuthResponse struct {
	Token string   `json:"token"`
	User  AuthUser `json:"user"`
}

type DiscoveryRecord struct {
	ID        string                `json:"id"`
	Query     string                `json:"query"`
	CreatedAt string                `json:"createdAt"`
	Result    IdiomExtractionResult `json:"result"`
}
