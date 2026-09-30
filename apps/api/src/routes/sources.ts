import type { FastifyInstance, FastifyReply } from "fastify";
import {
  isUuid,
  parseSourceListQuery,
  validateCreateSourceInput,
  validateSetSourceActiveInput,
  validateUpdateSourceInput,
} from "@foundryjobs/shared";
import {
  createSource,
  deleteSource,
  getSourceById,
  listSources,
  setSourceActive,
  SourceConflictError,
  updateSource,
} from "@foundryjobs/db";

function errorBody(message: string): { error: { message: string } } {
  return { error: { message } };
}

function sendValidationError(reply: FastifyReply, errors: string[]) {
  return reply.status(400).send(errorBody(errors.join("; ")));
}

function sendNotFound(reply: FastifyReply) {
  return reply.status(404).send(errorBody("Source not found"));
}

export async function registerSourceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/sources", async (request, reply) => {
    const parsed = parseSourceListQuery(request.query);
    if (!parsed.ok) {
      return sendValidationError(reply, parsed.errors);
    }

    const data = await listSources(parsed.data);
    return { data };
  });

  app.get<{ Params: { id: string } }>("/v1/sources/:id", async (request, reply) => {
    const { id } = request.params;
    if (!isUuid(id)) {
      return sendValidationError(reply, ["id must be a valid UUID"]);
    }

    const source = await getSourceById(id);
    if (!source) {
      return sendNotFound(reply);
    }
    return { data: source };
  });

  app.post("/v1/sources", async (request, reply) => {
    const parsed = validateCreateSourceInput(request.body);
    if (!parsed.ok) {
      return sendValidationError(reply, parsed.errors);
    }

    try {
      const source = await createSource(parsed.data);
      return reply.status(201).send({ data: source });
    } catch (error) {
      if (error instanceof SourceConflictError) {
        return sendValidationError(reply, [error.message]);
      }
      throw error;
    }
  });

  app.patch<{ Params: { id: string } }>("/v1/sources/:id", async (request, reply) => {
    const { id } = request.params;
    if (!isUuid(id)) {
      return sendValidationError(reply, ["id must be a valid UUID"]);
    }

    const parsed = validateUpdateSourceInput(request.body);
    if (!parsed.ok) {
      return sendValidationError(reply, parsed.errors);
    }

    try {
      const source = await updateSource(id, parsed.data);
      if (!source) {
        return sendNotFound(reply);
      }
      return { data: source };
    } catch (error) {
      if (error instanceof SourceConflictError) {
        return sendValidationError(reply, [error.message]);
      }
      throw error;
    }
  });

  app.patch<{ Params: { id: string } }>("/v1/sources/:id/active", async (request, reply) => {
    const { id } = request.params;
    if (!isUuid(id)) {
      return sendValidationError(reply, ["id must be a valid UUID"]);
    }

    const parsed = validateSetSourceActiveInput(request.body);
    if (!parsed.ok) {
      return sendValidationError(reply, parsed.errors);
    }

    const source = await setSourceActive(id, parsed.data.isActive);
    if (!source) {
      return sendNotFound(reply);
    }
    return { data: source };
  });

  app.delete<{ Params: { id: string } }>("/v1/sources/:id", async (request, reply) => {
    const { id } = request.params;
    if (!isUuid(id)) {
      return sendValidationError(reply, ["id must be a valid UUID"]);
    }

    const deleted = await deleteSource(id);
    if (!deleted) {
      return sendNotFound(reply);
    }
    return reply.status(204).send();
  });
}
