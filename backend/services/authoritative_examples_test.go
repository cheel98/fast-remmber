package services

import (
	"testing"

	"fast-remmber-backend/models"
)

func TestExtractSentenceContainingIdiom(t *testing.T) {
	sentence := extractSentenceContainingIdiom(
		`<p>学习和坚守“道”很不容易，但更难能可贵的是能够通权达变，在重大关头作出迅捷决断。</p><p>其他内容。</p>`,
		"通权达变",
	)

	expected := `学习和坚守“道”很不容易，但更难能可贵的是能够通权达变，在重大关头作出迅捷决断。`
	if sentence != expected {
		t.Fatalf("expected %q, got %q", expected, sentence)
	}
}

func TestMergeUsageExamplesKeepsUniqueExamples(t *testing.T) {
	examples := mergeUsageExamples(
		[]models.UsageExample{{
			Usage:     "已有例句",
			Sentence:  "这是一条例句。",
			Source:    "人民网",
			SourceURL: "http://example.com/a",
		}},
		[]models.UsageExample{
			{
				Usage:     "重复例句",
				Sentence:  "这是一条例句。",
				Source:    "人民网",
				SourceURL: "http://example.com/a",
			},
			{
				Usage:     "新增例句",
				Sentence:  "这是第二条例句。",
				Source:    "人民网",
				SourceURL: "http://example.com/b",
			},
		},
		3,
	)

	if len(examples) != 2 {
		t.Fatalf("expected 2 merged examples, got %d", len(examples))
	}
}
