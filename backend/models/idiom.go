package models

type RelationshipDetail struct {
	Name           string  `json:"name"`
	Strength       float64 `json:"strength"` // 0.0 to 1.0
	SimilarityType string  `json:"similarityType,omitempty"`
	Difference     string  `json:"difference,omitempty"`
	SourceExample  string  `json:"sourceExample,omitempty"`
	TargetExample  string  `json:"targetExample,omitempty"`
	HasAIExplore   bool    `json:"hasAIExplore"`
}

type UsageExample struct {
	Title     string `json:"title"`
	Usage     string `json:"usage"`
	Sentence  string `json:"sentence"`
	Source    string `json:"source"`
	SourceURL string `json:"sourceUrl"`
}

type IdiomExtractionResult struct {
	Idiom        string               `json:"idiom"`
	Meaning      string               `json:"meaning"`
	Synonyms     []RelationshipDetail `json:"synonyms"`
	Antonyms     []RelationshipDetail `json:"antonyms"`
	Examples     []UsageExample       `json:"examples"`
	Emotions     string               `json:"emotions"`
	HasAIExplore bool                 `json:"hasAIExplore"`
}

type GraphNode struct {
	ID         string `json:"id"`
	Label      string `json:"label"` // e.g. "Idiom" or "Word"
	Type       string `json:"type,omitempty"`
	Emotion    string `json:"emotion,omitempty"`
	HasMeaning bool   `json:"hasMeaning"`
	Degree     int    `json:"degree,omitempty"`
}

type GraphLink struct {
	Source         string  `json:"source"`
	Target         string  `json:"target"`
	Label          string  `json:"label"` // e.g. "SYNONYM", "ANTONYM"
	Strength       float64 `json:"strength"`
	SimilarityType string  `json:"similarityType,omitempty"`
	Difference     string  `json:"difference,omitempty"`
	SourceExample  string  `json:"sourceExample,omitempty"`
	TargetExample  string  `json:"targetExample,omitempty"`
}

type GraphData struct {
	Nodes []GraphNode `json:"nodes"`
	Links []GraphLink `json:"links"`
}

type AssociateRequest struct {
	Source         string  `json:"source" binding:"required"`
	Target         string  `json:"target" binding:"required"`
	Label          string  `json:"label"` // Optional, e.g. "RELATED"
	Strength       float64 `json:"strength"`
	SimilarityType string  `json:"similarityType,omitempty"`
	Difference     string  `json:"difference,omitempty"`
	SourceExample  string  `json:"sourceExample,omitempty"`
	TargetExample  string  `json:"targetExample,omitempty"`
}

type DissociateRequest struct {
	Source string `json:"source" binding:"required"`
	Target string `json:"target" binding:"required"`
	Label  string `json:"label" binding:"required"`
}

type ImageParseRequest struct {
	ImageBase64 string `json:"image" binding:"required"`
}

type ImageParseResponse struct {
	QuestionAnalysis string      `json:"questionAnalysis"`
	Nodes            []GraphNode `json:"nodes"`
	Links            []GraphLink `json:"links"`
}
