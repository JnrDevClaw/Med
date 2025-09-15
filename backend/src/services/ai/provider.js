export class ProviderRegistry {
  constructor() {
    this.providers = [];
  }

  register(provider) {
    this.providers.push(provider);
  }

  get(model) {
    return this.providers.find(p => p.supports(model));
  }
}

export { ProviderRegistry };
