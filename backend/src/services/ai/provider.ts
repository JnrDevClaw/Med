export interface AIRequestContext {
  model: string;
  message: string;
  symptoms?: string[];
  previousMessages?: { role: 'user' | 'assistant'; content: string; timestamp?: string }[];
}

export interface AIResponse {
  response: string;
  confidence: number;
  followUpQuestions?: string[];
  escalationRecommended: boolean;
  tokensUsed?: number;
  processingTime?: number;
  provider: string;
}

export interface AIProvider {
  name: string;
  supports(model: string): boolean;
  invoke(ctx: AIRequestContext): Promise<AIResponse>;
}

export class ProviderRegistry {
  private providers: AIProvider[] = [];
  register(p: AIProvider) { this.providers.push(p); }
  get(model: string): AIProvider | undefined { return this.providers.find(p => p.supports(model)); }
}
