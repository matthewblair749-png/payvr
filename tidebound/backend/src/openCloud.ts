// Minimal Roblox Open Cloud client: DataStores, MessagingService, and user notifications.
export type Fetch = typeof fetch;

export class OpenCloud {
  constructor(
    private readonly apiKey: string,
    private readonly universeId: string,
    private readonly fetchImpl: Fetch = fetch,
  ) {}

  private async call(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Promise<Response> {
    const res = await this.fetchImpl(url, {
      method,
      headers: { "x-api-key": this.apiKey, ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Open Cloud ${method} ${url} failed: ${res.status} ${await res.text()}`);
    }
    return res;
  }

  private entryUrl(datastore: string, key: string): string {
    const q = new URLSearchParams({ datastoreName: datastore, entryKey: key });
    return `https://apis.roblox.com/datastores/v1/universes/${this.universeId}/standard-datastores/datastore/entries/entry?${q}`;
  }

  async getEntry<T = unknown>(datastore: string, key: string): Promise<T | undefined> {
    const res = await this.call("GET", this.entryUrl(datastore, key));
    if (res.status === 404) return undefined;
    return (await res.json()) as T;
  }

  async setEntry(datastore: string, key: string, value: unknown): Promise<void> {
    await this.call("POST", this.entryUrl(datastore, key), value);
  }

  async deleteEntry(datastore: string, key: string): Promise<void> {
    await this.call("DELETE", this.entryUrl(datastore, key));
  }

  async publish(topic: string, message: string): Promise<void> {
    await this.call("POST", `https://apis.roblox.com/messaging-service/v1/universes/${this.universeId}/topics/${encodeURIComponent(topic)}`, { message });
  }

  // Sends an experience notification (players must have opted in inside the game).
  async notify(userId: number, messageId: string, launchData: string, category: string): Promise<void> {
    await this.call("POST", `https://apis.roblox.com/cloud/v2/users/${userId}/notifications`, {
      source: { universe: `universes/${this.universeId}` },
      payload: { messageId, type: "MOMENT", joinExperience: { launchData }, analyticsData: { category } },
    });
  }
}
