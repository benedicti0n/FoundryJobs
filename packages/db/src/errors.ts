export class DatabaseNotConfiguredError extends Error {
  constructor(message = "DATABASE_URL is required for source repository operations") {
    super(message);
    this.name = "DatabaseNotConfiguredError";
  }
}

export class SourceConflictError extends Error {
  constructor(message = "A source with this URL already exists") {
    super(message);
    this.name = "SourceConflictError";
  }
}
