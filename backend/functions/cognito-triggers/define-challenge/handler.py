"""
Cognito DefineAuthChallenge trigger.

Called by Cognito to decide what challenge to present next in the CUSTOM_AUTH flow.
For passwordless OTP: always issue CUSTOM_CHALLENGE until the user answers correctly.
"""


def handler(event: dict, context: object) -> dict:
    request = event.get("request", {})
    session = request.get("session", [])

    # Session is a list of previous challenge/answer pairs.
    if not session:
        # First call — issue the custom OTP challenge.
        event["response"]["challengeName"] = "CUSTOM_CHALLENGE"
        event["response"]["issueTokens"] = False
        event["response"]["failAuthentication"] = False
    elif _last_challenge_correct(session):
        # User answered correctly — issue tokens.
        event["response"]["challengeName"] = "CUSTOM_CHALLENGE"
        event["response"]["issueTokens"] = True
        event["response"]["failAuthentication"] = False
    elif len(session) >= 3:
        # Too many incorrect attempts — fail auth.
        event["response"]["issueTokens"] = False
        event["response"]["failAuthentication"] = True
    else:
        # Wrong answer but retries remain — re-issue challenge.
        event["response"]["challengeName"] = "CUSTOM_CHALLENGE"
        event["response"]["issueTokens"] = False
        event["response"]["failAuthentication"] = False

    return event


def _last_challenge_correct(session: list) -> bool:
    """Return True if the most recent challenge was answered correctly."""
    if not session:
        return False
    last = session[-1]
    return (
        last.get("challengeName") == "CUSTOM_CHALLENGE"
        and last.get("challengeResult") is True
    )
