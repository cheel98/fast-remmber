package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"fast-remmber-backend/models"
	
	openai "github.com/sashabaranov/go-openai"
)

func ExtractIdiomRelations(ctx context.Context, text string) (*models.IdiomExtractionResult, error) {
	apiKey := os.Getenv("LLM_API_KEY")
	if apiKey == "" {
		apiKey = os.Getenv("QWEN_API_KEY")
	}
	if apiKey == "" {
		return nil, fmt.Errorf("LLM_API_KEY or QWEN_API_KEY is not set")
	}

	baseURL := os.Getenv("LLM_BASE_URL")
	if baseURL == "" {
		// Default to Dashscope if using QWEN_API_KEY, otherwise let go-openai handle default (usually OpenAI)
		if os.Getenv("QWEN_API_KEY") != "" && os.Getenv("LLM_API_KEY") == "" {
			baseURL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
		}
	}

	model := os.Getenv("LLM_MODEL")
	if model == "" {
		return nil, fmt.Errorf("LLM_MODEL is not set in environment")
	}

	config := openai.DefaultConfig(apiKey)
	if baseURL != "" {
		config.BaseURL = baseURL
	}
	
	// Logging for debug
	maskedKey := ""
	if len(apiKey) > 8 {
		maskedKey = apiKey[:4] + "****" + apiKey[len(apiKey)-4:]
	} else {
		maskedKey = "invalid-key"
	}
	log.Printf("LLM Config: Model=%s, BaseURL=%s, APIKey=%s", model, baseURL, maskedKey)

	client := openai.NewClientWithConfig(config)

	systemPrompt := `你是一个成语解析引擎。请解析用户输入的成语，并以严格的JSON格式返回以下字段：
- idiom: 成语本身
- meaning: 成语的意思
- synonyms: 近义成语数组。每个元素为对象：{"name": "成语", "strength": 0.0-1.0}，强度0.1表示微弱相关，1.0表示语义完全等同。
- antonyms: 反义成语数组。每个元素为对象：{"name": "成语", "strength": 0.0-1.0}，强度0.1表示轻微对立，1.0表示绝对截然相反。
- emotions: 词语情感色彩 (褒义、贬义、中性)

注意：
1. 只返回JSON，不包含多余解释。
2. 强度值请根据词义的重合或对立程度给出合理的连续分值。`

	req := openai.ChatCompletionRequest{
		Model: model,
		Messages: []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleSystem,
				Content: systemPrompt,
			},
			{
				Role:    openai.ChatMessageRoleUser,
				Content: text,
			},
		},
		ResponseFormat: &openai.ChatCompletionResponseFormat{
			Type: openai.ChatCompletionResponseFormatTypeJSONObject,
		},
	}

	resp, err := client.CreateChatCompletion(ctx, req)
	if err != nil {
		log.Printf("LLM Error: %v", err)
		return nil, err
	}

	rawContent := resp.Choices[0].Message.Content
	log.Printf("LLM Raw Response: %s", rawContent)

	var result models.IdiomExtractionResult
	err = json.Unmarshal([]byte(rawContent), &result)
	if err != nil {
		log.Printf("JSON Unmarshal Error: %v | Content: %s", err, rawContent)
		return nil, fmt.Errorf("failed to parse JSON from LLM: %v", err)
	}

	return &result, nil
}
