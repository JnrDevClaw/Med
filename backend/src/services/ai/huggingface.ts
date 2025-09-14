import { AIProvider, AIRequestContext, AIResponse } from './provider';
import fetch from 'node-fetch';

// Simple HuggingFace inference wrapper; real implementation would map model ids to HF endpoints
export class HuggingFaceProvider implements AIProvider {
  name = 'huggingface';
  constructor(private apiKey: string, private baseUrl = 'https://api-inference.huggingface.co/models') {}

  supports(model: string): boolean {
    return ['biogpt','mistral-med','clinical-bert'].includes(model);
  }

  async invoke(ctx: AIRequestContext): Promise<AIResponse> {
    const start = Date.now();
    // Map internal model names to HF repository names (placeholder mapping)
    const repoMap: Record<string,string> = {
      'biogpt': 'microsoft/BioGPT-Large',
      'mistral-med': 'mistralai/Mistral-7B-Instruct-v0.3',
      'clinical-bert': 'emilyalsentzer/Bio_ClinicalBERT'
    };
    const repo = repoMap[ctx.model] || repoMap['biogpt'];

    const payload = { inputs: buildPrompt(ctx) };
    let text = '';
    let confidence = 0.8;
    try {
      const res = await fetch(`${this.baseUrl}/${repo}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        text = fallbackResponse(ctx);
      } else {
        const json: any = await res.json();
        // HF responses vary; attempt extraction
        if (Array.isArray(json) && json[0]?.generated_text) {
          text = json[0].generated_text;
        } else if (json.generated_text) {
          text = json.generated_text;
        } else {
          text = JSON.stringify(json);
        }
      }
    } catch (e) {
      text = fallbackResponse(ctx);
    }

    const processingTime = Date.now() - start;
    return {
      response: text,
      confidence,
      followUpQuestions: genericFollowUps(),
      escalationRecommended: detectEscalation(ctx.message, ctx.symptoms),
      tokensUsed: estimateTokens(text),
      processingTime,
      provider: this.name
    };
  }
}

function buildPrompt(ctx: AIRequestContext): string {
  const history = (ctx.previousMessages || []).map(m => `${m.role}: ${m.content}`).join('\n');
  const symptoms = ctx.symptoms?.length ? `Symptoms: ${ctx.symptoms.join(', ')}` : '';
  return `${history}\n${symptoms}\nUser: ${ctx.message}\nAssistant:`;
}

function genericFollowUps(): string[] {
  return [
    'How long have you experienced these symptoms?',
    'Have you taken any medications?',
    'Do you have chronic conditions?',
  ];
}

function detectEscalation(message: string, symptoms?: string[]): boolean {
  const redFlags = ['chest pain','shortness of breath','unconscious','severe bleeding'];
  const text = `${message} ${(symptoms||[]).join(' ')}`.toLowerCase();
  return redFlags.some(f => text.includes(f));
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4); // rough heuristic
}

function fallbackResponse(ctx: AIRequestContext): string {
  return 'Unable to retrieve model response currently. Providing generalized guidance: consult a licensed professional for a definitive assessment.';
}
