package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"os"
	"strings"

	"fast-remmber-backend/models"

	openai "github.com/sashabaranov/go-openai"
)

var authoritativeSourceKeywords = []string{
	"\u4eba\u6c11\u7f51",
	"\u4eba\u6c11\u65e5\u62a5",
	"people.com.cn",
	"people.cn",
	"people's daily",
	"\u65b0\u534e\u7f51",
	"\u65b0\u534e\u793e",
	"xinhua",
	"news.cn",
	"xinhuanet",
}

var authoritativeSourceDomains = []string{
	"people.com.cn",
	"people.cn",
	"xinhuanet.com",
	"news.cn",
}

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

	systemPrompt := strings.Join([]string{
		"你是一个中文成语解析引擎。请解析用户输入的成语，并以严格 JSON 返回以下字段：",
		"- idiom: 成语本身",
		"- meaning: 成语释义，简洁准确",
		"- synonyms: 近义成语数组，只记录与当前成语容易混淆或语义相近的成语，包含“形近”与“意近”两类。每项为 {\"name\":\"成语\",\"strength\":0.0-1.0,\"similarityType\":\"形近|意近\",\"difference\":\"两个成语的关键区别\",\"sourceExample\":\"当前成语的简短例句\",\"targetExample\":\"该近义成语的简短例句\"}",
		"- antonyms: 固定返回空数组 []",
		"- examples: 例句数组，尽量返回 2 到 4 条不同用法或不同语境的例句。每项为 {\"usage\":\"用法说明\",\"sentence\":\"完整例句\",\"source\":\"来源名称\",\"sourceUrl\":\"文章链接\"}",
		"- emotions: 情感色彩，例如褒义、贬义、中性",
		"",
		"规则：",
		"1. 只返回 JSON，不要输出任何额外说明。",
		"1.1 idiom 字段必须原样返回用户输入，不要改写，不要替换成问号。",
		"2. synonyms 只允许返回近义或易混淆成语，不要返回反义成语，也不要返回泛泛相关词。",
		"3. similarityType 只能填写“形近”或“意近”，并选择最主要的一类。",
		"4. difference 要聚焦两个成语最容易混淆的差别，尽量用一句话说清。",
		"5. sourceExample 必须使用当前输入的成语，targetExample 必须使用对应近义成语，例句要自然简洁。",
		"6. examples 中的例句必须尽量体现不同用法、不同语境。",
		"7. 例句来源必须限定为权威官方中文来源，优先使用人民网、人民日报、新华网、新华社及其官方站点。",
		"8. source 和 sourceUrl 必须填写真实可核验的信息。",
		"9. 如果无法确认例句确实来自上述权威来源，请返回空数组 examples: []。",
		"10. 不要编造来源名称、文章标题或链接。",
		"11. strength 需要反映两个成语的接近程度，数值越大表示越容易混淆或越接近。",
		"12. 对于常见的中文四字成语，默认按有效成语处理并正常解析，不要因为缺少上下文而判定为无效输入。",
		"13. 只有在输入明显不是成语、或者完全不是中文时，才可以返回“无效输入”一类结果。",
	}, "\n")

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

	result.Synonyms = normalizeRelationshipDetails(result.Synonyms)
	result.Antonyms = []models.RelationshipDetail{}
	result.Examples = EnsureAuthoritativeExamples(ctx, result.Idiom, result.Meaning, result.Examples)

	return &result, nil
}

func normalizeRelationshipDetails(details []models.RelationshipDetail) []models.RelationshipDetail {
	if len(details) == 0 {
		return []models.RelationshipDetail{}
	}

	normalized := make([]models.RelationshipDetail, 0, len(details))
	seen := make(map[string]struct{}, len(details))

	for _, detail := range details {
		name := strings.TrimSpace(detail.Name)
		if name == "" {
			continue
		}
		if _, exists := seen[name]; exists {
			continue
		}
		seen[name] = struct{}{}

		detail.Name = name
		detail.SimilarityType = normalizeSimilarityType(detail.SimilarityType)
		detail.Difference = strings.TrimSpace(detail.Difference)
		detail.SourceExample = strings.TrimSpace(detail.SourceExample)
		detail.TargetExample = strings.TrimSpace(detail.TargetExample)

		if detail.Strength < 0 {
			detail.Strength = 0
		}
		if detail.Strength > 1 {
			detail.Strength = 1
		}

		normalized = append(normalized, detail)
	}

	return normalized
}

func normalizeSimilarityType(value string) string {
	similarityType := strings.TrimSpace(strings.ToLower(value))
	switch {
	case strings.Contains(similarityType, "形") || strings.Contains(similarityType, "shape") || strings.Contains(similarityType, "orth"):
		return "形近"
	case strings.Contains(similarityType, "意") || strings.Contains(similarityType, "mean") || strings.Contains(similarityType, "semantic"):
		return "意近"
	default:
		return ""
	}
}

func normalizeUsageExamples(examples []models.UsageExample) []models.UsageExample {
	if len(examples) == 0 {
		return []models.UsageExample{}
	}

	normalized := make([]models.UsageExample, 0, len(examples))
	seen := make(map[string]struct{}, len(examples))

	for _, example := range examples {
		usage := strings.TrimSpace(example.Usage)
		sentence := strings.TrimSpace(example.Sentence)
		source := strings.TrimSpace(example.Source)
		sourceURL := strings.TrimSpace(example.SourceURL)

		if usage == "" || sentence == "" || source == "" || sourceURL == "" {
			continue
		}
		if !isAuthoritativeSource(source, sourceURL) {
			continue
		}

		key := usage + "|" + sentence + "|" + sourceURL
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}

		normalized = append(normalized, models.UsageExample{
			Title:     strings.TrimSpace(example.Title),
			Usage:     usage,
			Sentence:  sentence,
			Source:    source,
			SourceURL: sourceURL,
		})
	}

	return normalized
}

func isAuthoritativeSource(sourceName string, rawURL string) bool {
	if !matchesAuthoritativeSourceName(sourceName) {
		return false
	}

	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.Host == "" {
		return false
	}

	host := strings.ToLower(parsed.Hostname())
	for _, domain := range authoritativeSourceDomains {
		if host == domain || strings.HasSuffix(host, "."+domain) {
			return true
		}
	}

	return false
}

func matchesAuthoritativeSourceName(sourceName string) bool {
	name := strings.ToLower(strings.TrimSpace(sourceName))
	if name == "" {
		return false
	}

	for _, keyword := range authoritativeSourceKeywords {
		if strings.Contains(name, strings.ToLower(keyword)) {
			return true
		}
	}

	return false
}

func ExtractIdiomsFromImage(ctx context.Context, base64Image string) (*models.ImageParseResponse, error) {
	apiKey := os.Getenv("LLM_API_KEY")
	if apiKey == "" {
		apiKey = os.Getenv("QWEN_API_KEY")
	}
	if apiKey == "" {
		return nil, fmt.Errorf("LLM_API_KEY or QWEN_API_KEY is not set")
	}

	baseURL := os.Getenv("LLM_BASE_URL")
	if baseURL == "" {
		if os.Getenv("QWEN_API_KEY") != "" && os.Getenv("LLM_API_KEY") == "" {
			baseURL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
		}
	}

	model := os.Getenv("LLM_VISION_MODEL")
	if model == "" {
		model = os.Getenv("LLM_MODEL") // fallback to default
	}

	config := openai.DefaultConfig(apiKey)
	if baseURL != "" {
		config.BaseURL = baseURL
	}

	client := openai.NewClientWithConfig(config)

	systemPrompt := strings.Join([]string{
		"你是一个专门解析中文语文考试试题中成语的智能分析引擎。用户提供了一张包含题目及选项的图片。",
		"请你仔细阅读这张图片：",
		"1. 提取出图片试题或文本中涉及到的所有成语。",
		"2. 给出一份“questionAnalysis”（题目解析，简明扼要）。如果图片涉及选择题，请务必在解析段落的最开头以【正确答案：X】的形式明确给出你推断的参考答案选项。",
		"3. 分析提取的成语间的相互关系，例如 SYNONYM（近义）、ANTONYM（反义）、RELATED（相关）、ANALOGY（类比）或 EASY_TO_CONFUSE（易混淆）。",
		"",
		"请以严格的 JSON 格式返回，结构如下：",
		"{",
		"  \"questionAnalysis\": \"这是一道关于成语辨析的选择题...\",",
		"  \"nodes\": [",
		"    {\"id\": \"成语A\", \"label\": \"成语A\", \"hasMeaning\": true, \"emotion\": \"褒义\"},",
		"    {\"id\": \"成语B\", \"label\": \"成语B\", \"hasMeaning\": true, \"emotion\": \"中性\"}",
		"  ],",
		"  \"links\": [",
		"    {\"source\": \"成语A\", \"target\": \"成语B\", \"label\": \"EASY_TO_CONFUSE\", \"strength\": 0.8}",
		"  ]",
		"}",
		"",
		"规则：",
		"- 严格按照 JSON 格式输出，不要包含任何 markdown 代码块（如 ```json）和其他冗余文字。",
		"- 如果图片中没有成语，nodes和links返回空数组。",
		"- strength在0.0到1.0之间。",
	}, "\n")

	// Ensure the base64 string has the correct prefix
	dataURI := base64Image
	if !strings.HasPrefix(base64Image, "data:image") {
		dataURI = "data:image/jpeg;base64," + base64Image
	}

	req := openai.ChatCompletionRequest{
		Model: model,
		Messages: []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleSystem,
				Content: systemPrompt,
			},
			{
				Role: openai.ChatMessageRoleUser,
				MultiContent: []openai.ChatMessagePart{
					{
						Type: openai.ChatMessagePartTypeImageURL,
						ImageURL: &openai.ChatMessageImageURL{
							URL: dataURI,
						},
					},
				},
			},
		},
		ResponseFormat: &openai.ChatCompletionResponseFormat{
			Type: openai.ChatCompletionResponseFormatTypeJSONObject,
		},
	}

	resp, err := client.CreateChatCompletion(ctx, req)
	if err != nil {
		log.Printf("Vision LLM Error: %v", err)
		return nil, err
	}

	rawContent := resp.Choices[0].Message.Content
	log.Printf("Vision LLM Raw Response: %s", rawContent)

	var result models.ImageParseResponse
	err = json.Unmarshal([]byte(rawContent), &result)
	if err != nil {
		log.Printf("Vision JSON Unmarshal Error: %v | Content: %s", err, rawContent)
		return nil, fmt.Errorf("failed to parse vision JSON from LLM: %v", err)
	}

	return &result, nil
}
