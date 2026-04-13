package models

type AuthCredentialsRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password"`
}

type AuthUser struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	CreatedAt string `json:"createdAt"`
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
