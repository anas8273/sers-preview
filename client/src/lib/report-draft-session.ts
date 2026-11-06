export type ReportDraftContent = {
  templateId: string;
  themeId: string;
  fontFamily: string;
  fields: Record<string, string>;
  evidenceAssetIds: number[];
};

type Receipt = { revision: number; updatedAt: string };
type Write = (draft: ReportDraftContent, revision: number) => Promise<Receipt>;

/** One session per open report. Edits replace the content object so an
 * acknowledgement can only confirm the exact snapshot sent to the server. */
export class ReportDraftSession {
  private confirmed: ReportDraftContent;
  private inFlight?: Promise<number>;
  content: ReportDraftContent;
  revision: number;

  constructor(revision: number, confirmed: ReportDraftContent, initial = confirmed) {
    this.revision = revision;
    this.confirmed = confirmed;
    this.content = initial;
  }

  get dirty() { return this.content !== this.confirmed; }

  edit(changes: Partial<ReportDraftContent>) {
    this.content = { ...this.content, ...changes };
    return this.content;
  }

  flush(write: Write, acknowledged: (receipt: Receipt) => void): Promise<number> {
    if (!this.inFlight) {
      this.inFlight = this.saveChanges(write, acknowledged)
        .finally(() => { this.inFlight = undefined; });
    }
    return this.inFlight;
  }

  private async saveChanges(write: Write, acknowledged: (receipt: Receipt) => void) {
    while (this.dirty) {
      const sent = this.content;
      const receipt = await write(sent, this.revision);
      this.revision = receipt.revision;
      this.confirmed = sent;
      acknowledged(receipt);
    }
    return this.revision;
  }
}
