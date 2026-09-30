export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is required for source repository operations");
    this.name = "DatabaseNotConfiguredError";
  }
}

export class SourceConflictError extends Error {
  constructor(message = "A source with this URL already exists") {
    super(message);
    this.name = "SourceConflictError";
  }
}
