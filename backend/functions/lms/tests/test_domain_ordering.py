"""
Unit tests — Domain-wise question ordering (Phase D).

TDD RED phase: these tests define the required behaviour BEFORE implementation.

Requirement:
  - Questions delivered in domain order: legal → financial → physical → digital
  - Exactly 10 questions per domain (40 total)
  - Order is deterministic — no randomisation
  - Each returned question includes a 'domain' field
  - Domain progress can be calculated from the ordered question list

Tests are isolated — no DynamoDB, no AWS calls, no network.
"""
import pytest
from typing import Any


# ---------------------------------------------------------------------------
# Module under test
# We import the sorting helper that we are ABOUT to create.
# Before implementation this import will succeed only after we add the module.
# ---------------------------------------------------------------------------
from routes.assessment import (
    sort_questions_by_domain,
    calculate_domain_progress,
    DOMAIN_ORDER,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

DOMAIN_ORDER_EXPECTED = ["legal", "financial", "physical", "digital"]


def make_question(domain: str, number: int, question_id: str | None = None) -> dict:
    """Build a minimal question dict matching the DynamoDB schema."""
    return {
        "questionId": question_id or f"{domain}-q{number}",
        "text": f"{domain.capitalize()} question {number}",
        "domain": domain,
        "number": number,
        "order": number,
        "answers": [
            {"label": "A", "text": "Not Started", "score": 0},
            {"label": "B", "text": "In Progress", "score": 1},
            {"label": "C", "text": "Almost Done", "score": 2},
            {"label": "D", "text": "Fully Complete", "score": 3},
        ],
    }


def make_40_questions_shuffled() -> list[dict]:
    """Return 40 questions intentionally shuffled (digital first, then legal, etc.)."""
    questions = []
    # Add in reverse domain order to confirm sorting corrects this
    for domain in ["digital", "physical", "financial", "legal"]:
        for i in range(1, 11):
            base_number = DOMAIN_ORDER_EXPECTED.index(domain) * 10 + i
            questions.append(make_question(domain, base_number))
    return questions


def make_40_questions_ordered() -> list[dict]:
    """Return 40 questions already in correct domain order."""
    questions = []
    for d_idx, domain in enumerate(DOMAIN_ORDER_EXPECTED):
        for i in range(1, 11):
            questions.append(make_question(domain, d_idx * 10 + i))
    return questions


# ---------------------------------------------------------------------------
# 1. DOMAIN_ORDER constant
# ---------------------------------------------------------------------------

class TestDomainOrderConstant:
    def test_domain_order_has_four_domains(self):
        assert len(DOMAIN_ORDER) == 4

    def test_domain_order_is_legal_financial_physical_digital(self):
        assert list(DOMAIN_ORDER) == ["legal", "financial", "physical", "digital"]

    def test_domain_order_is_immutable_tuple(self):
        """DOMAIN_ORDER must be a tuple so it cannot be accidentally mutated."""
        assert isinstance(DOMAIN_ORDER, tuple)


# ---------------------------------------------------------------------------
# 2. sort_questions_by_domain — happy path
# ---------------------------------------------------------------------------

class TestSortQuestionsByDomain:
    def test_returns_list(self):
        questions = make_40_questions_shuffled()
        result = sort_questions_by_domain(questions)
        assert isinstance(result, list)

    def test_returns_same_count(self):
        questions = make_40_questions_shuffled()
        result = sort_questions_by_domain(questions)
        assert len(result) == 40

    def test_first_10_are_legal(self):
        questions = make_40_questions_shuffled()
        result = sort_questions_by_domain(questions)
        domains = [q["domain"] for q in result[:10]]
        assert all(d == "legal" for d in domains), f"Expected all legal, got: {set(domains)}"

    def test_second_10_are_financial(self):
        questions = make_40_questions_shuffled()
        result = sort_questions_by_domain(questions)
        domains = [q["domain"] for q in result[10:20]]
        assert all(d == "financial" for d in domains)

    def test_third_10_are_physical(self):
        questions = make_40_questions_shuffled()
        result = sort_questions_by_domain(questions)
        domains = [q["domain"] for q in result[20:30]]
        assert all(d == "physical" for d in domains)

    def test_fourth_10_are_digital(self):
        questions = make_40_questions_shuffled()
        result = sort_questions_by_domain(questions)
        domains = [q["domain"] for q in result[30:40]]
        assert all(d == "digital" for d in domains)

    def test_within_domain_sorted_by_number_ascending(self):
        questions = make_40_questions_shuffled()
        result = sort_questions_by_domain(questions)
        legal_numbers = [q["number"] for q in result if q["domain"] == "legal"]
        assert legal_numbers == sorted(legal_numbers)

    def test_already_ordered_input_unchanged(self):
        questions = make_40_questions_ordered()
        result = sort_questions_by_domain(questions)
        result_domains = [q["domain"] for q in result]
        expected_domains = [q["domain"] for q in questions]
        assert result_domains == expected_domains

    def test_no_domain_before_earlier_domain(self):
        """No question from a later domain may appear before an earlier-domain question."""
        questions = make_40_questions_shuffled()
        result = sort_questions_by_domain(questions)
        domain_rank = {d: i for i, d in enumerate(DOMAIN_ORDER_EXPECTED)}
        for i in range(1, len(result)):
            prev_rank = domain_rank.get(result[i - 1]["domain"], -1)
            curr_rank = domain_rank.get(result[i]["domain"], -1)
            assert curr_rank >= prev_rank, (
                f"Out-of-order at position {i}: "
                f"{result[i-1]['domain']} → {result[i]['domain']}"
            )

    def test_does_not_mutate_input_list(self):
        """sort_questions_by_domain must return a new list, not modify in-place."""
        questions = make_40_questions_shuffled()
        original_first_domain = questions[0]["domain"]
        sort_questions_by_domain(questions)
        assert questions[0]["domain"] == original_first_domain

    def test_each_question_has_domain_field(self):
        questions = make_40_questions_shuffled()
        result = sort_questions_by_domain(questions)
        for q in result:
            assert "domain" in q, f"Question missing domain field: {q}"

    def test_deterministic_two_calls_produce_same_order(self):
        """Calling sort_questions_by_domain twice on the same input must yield identical output."""
        questions = make_40_questions_shuffled()
        result_1 = sort_questions_by_domain(questions)
        result_2 = sort_questions_by_domain(questions)
        assert [q["questionId"] for q in result_1] == [q["questionId"] for q in result_2]


# ---------------------------------------------------------------------------
# 3. sort_questions_by_domain — edge cases
# ---------------------------------------------------------------------------

class TestSortQuestionsByDomainEdgeCases:
    def test_empty_list_returns_empty(self):
        result = sort_questions_by_domain([])
        assert result == []

    def test_single_question_list(self):
        questions = [make_question("legal", 1)]
        result = sort_questions_by_domain(questions)
        assert len(result) == 1
        assert result[0]["domain"] == "legal"

    def test_unknown_domain_questions_placed_at_end(self):
        """Questions with a domain not in DOMAIN_ORDER go to the end."""
        questions = [
            make_question("digital", 31),
            make_question("unknown_domain", 99),
            make_question("legal", 1),
        ]
        result = sort_questions_by_domain(questions)
        assert result[0]["domain"] == "legal"
        assert result[1]["domain"] == "digital"
        assert result[2]["domain"] == "unknown_domain"

    def test_missing_domain_field_treated_as_unknown(self):
        """Questions without a domain field are placed at the end without crashing."""
        questions = [
            make_question("financial", 11),
            {"questionId": "no-domain", "text": "No domain question", "number": 99},
        ]
        result = sort_questions_by_domain(questions)
        assert result[0]["domain"] == "financial"
        # The question with no domain must still be returned
        assert any(q["questionId"] == "no-domain" for q in result)

    def test_partial_set_still_ordered(self):
        """Works correctly with fewer than 40 questions."""
        questions = [
            make_question("digital", 31),
            make_question("legal", 1),
            make_question("legal", 2),
        ]
        result = sort_questions_by_domain(questions)
        assert result[0]["domain"] == "legal"
        assert result[1]["domain"] == "legal"
        assert result[2]["domain"] == "digital"

    def test_duplicate_question_numbers_within_domain(self):
        """Duplicate question numbers do not cause a crash."""
        questions = [
            make_question("legal", 1, question_id="q1a"),
            make_question("legal", 1, question_id="q1b"),
            make_question("financial", 11),
        ]
        result = sort_questions_by_domain(questions)
        assert len(result) == 3
        # Both legal questions appear first
        assert result[0]["domain"] == "legal"
        assert result[1]["domain"] == "legal"


# ---------------------------------------------------------------------------
# 4. calculate_domain_progress
# ---------------------------------------------------------------------------

class TestCalculateDomainProgress:
    def test_returns_dict_with_all_four_domains(self):
        questions = make_40_questions_ordered()
        answers: dict[str, str] = {}
        progress = calculate_domain_progress(questions, answers)
        assert set(progress.keys()) == {"legal", "financial", "physical", "digital"}

    def test_zero_answers_gives_zero_progress_everywhere(self):
        questions = make_40_questions_ordered()
        progress = calculate_domain_progress(questions, {})
        assert all(v == 0 for v in progress.values())

    def test_all_legal_answered_gives_100_legal(self):
        questions = make_40_questions_ordered()
        # Answer all legal questions (Q1-Q10)
        answers = {q["questionId"]: "A" for q in questions if q["domain"] == "legal"}
        progress = calculate_domain_progress(questions, answers)
        assert progress["legal"] == 100
        assert progress["financial"] == 0
        assert progress["physical"] == 0
        assert progress["digital"] == 0

    def test_all_questions_answered_gives_100_everywhere(self):
        questions = make_40_questions_ordered()
        answers = {q["questionId"]: "A" for q in questions}
        progress = calculate_domain_progress(questions, answers)
        assert all(v == 100 for v in progress.values())

    def test_half_of_domain_answered_gives_50(self):
        questions = make_40_questions_ordered()
        # Answer 5 of 10 financial questions
        financial_qs = [q for q in questions if q["domain"] == "financial"][:5]
        answers = {q["questionId"]: "B" for q in financial_qs}
        progress = calculate_domain_progress(questions, answers)
        assert progress["financial"] == 50

    def test_progress_values_are_integers_0_to_100(self):
        questions = make_40_questions_ordered()
        # Answer 3 of 10 physical questions (30%)
        physical_qs = [q for q in questions if q["domain"] == "physical"][:3]
        answers = {q["questionId"]: "C" for q in physical_qs}
        progress = calculate_domain_progress(questions, answers)
        for val in progress.values():
            assert isinstance(val, int)
            assert 0 <= val <= 100

    def test_empty_questions_returns_zero_dict(self):
        progress = calculate_domain_progress([], {})
        assert isinstance(progress, dict)

    def test_answers_for_non_existent_questions_ignored(self):
        """Stale answer IDs that no longer map to a question must not raise."""
        questions = make_40_questions_ordered()
        answers = {"ghost-id-123": "A"}
        progress = calculate_domain_progress(questions, answers)
        assert all(v == 0 for v in progress.values())


# ---------------------------------------------------------------------------
# 5. Integration — sort then calculate progress
# ---------------------------------------------------------------------------

class TestSortThenProgress:
    def test_full_workflow_legal_first_then_progress(self):
        shuffled = make_40_questions_shuffled()
        ordered = sort_questions_by_domain(shuffled)

        # Simulate employee answering first 10 questions (all legal after sorting)
        answered_ids = {q["questionId"] for q in ordered[:10]}
        answers = {qid: "A" for qid in answered_ids}

        progress = calculate_domain_progress(ordered, answers)
        assert progress["legal"] == 100
        assert progress["financial"] == 0
        assert progress["physical"] == 0
        assert progress["digital"] == 0

    def test_domain_gating_check_legal_complete_before_financial(self):
        """Business rule: financial can only start once legal is 100%."""
        shuffled = make_40_questions_shuffled()
        ordered = sort_questions_by_domain(shuffled)

        # Only 5 of 10 legal answered
        legal_half = [q["questionId"] for q in ordered[:5]]
        answers = {qid: "B" for qid in legal_half}
        progress = calculate_domain_progress(ordered, answers)

        legal_complete = progress["legal"] == 100
        assert not legal_complete, "Legal should NOT be complete with only 5/10 answered"
