import { ok } from "../utils/apiResponse.js";
import { answerQuery, parseTripPrompt } from "../services/aiService.js";

export async function parseTrip(req, res) {
  return ok(res, "Trip prompt parsed", parseTripPrompt(req.body.prompt || ""));
}

export async function askAi(req, res) {
  return ok(res, "AI response", await answerQuery({ prompt: req.body.prompt || "", user: req.user }));
}
