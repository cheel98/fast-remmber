package services

import (
	"testing"

	"fast-remmber-backend/models"
)

func TestNormalizeUsageExamplesKeepsAuthoritativeExamples(t *testing.T) {
	examples := normalizeUsageExamples([]models.UsageExample{
		{
			Usage:     "用于批评空谈",
			Sentence:  "文章用这个成语批评只说不做的作风。",
			Source:    "人民网",
			SourceURL: "https://www.people.com.cn/n1/2024/0101/c1000-12345678.html",
		},
		{
			Usage:     "用于批评空谈",
			Sentence:  "文章用这个成语批评只说不做的作风。",
			Source:    "人民网",
			SourceURL: "https://www.people.com.cn/n1/2024/0101/c1000-12345678.html",
		},
		{
			Usage:     "用于强调务实",
			Sentence:  "评论借此强调真抓实干的重要性。",
			Source:    "新华网",
			SourceURL: "https://www.news.cn/politics/20240101/example.htm",
		},
	})

	if len(examples) != 2 {
		t.Fatalf("expected 2 normalized examples, got %d", len(examples))
	}
}

func TestNormalizeUsageExamplesDropsUnofficialOrIncompleteExamples(t *testing.T) {
	examples := normalizeUsageExamples([]models.UsageExample{
		{
			Usage:     "用于日常表达",
			Sentence:  "网友在社交平台上这样使用。",
			Source:    "某博客",
			SourceURL: "https://example.com/post",
		},
		{
			Usage:     "",
			Sentence:  "来源缺失的例句。",
			Source:    "人民网",
			SourceURL: "https://www.people.com.cn/n1/2024/0101/c1000-12345678.html",
		},
		{
			Usage:     "用于新闻评论",
			Sentence:  "新华社报道中这样使用。",
			Source:    "新华社",
			SourceURL: "",
		},
	})

	if len(examples) != 0 {
		t.Fatalf("expected unofficial or incomplete examples to be dropped, got %d", len(examples))
	}
}
