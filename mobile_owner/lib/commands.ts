export type CommandInput = {
  storageKey: string;
  cafeId: string;
  deviceId: string;
  kind: string;
  payload: Record<string, unknown>;
};
export type QueuedCommand = {
  id: string;
  cafe_id: string;
  device_id: string;
  kind: string;
  payload: Record<string, unknown>;
};
type Dependencies = {
  storage: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
    remove: (key: string) => Promise<void>;
  };
  newId: () => string;
  send: (command: QueuedCommand) => Promise<void>;
  refresh: () => Promise<void>;
};
// Keep the UUID across both network failures and app restarts. Only clear after
// the command is accepted and the queue can be read back from the server.
export async function queueCommand(
  input: CommandInput,
  deps: Dependencies,
): Promise<string> {
  const id = (await deps.storage.get(input.storageKey)) || deps.newId();
  await deps.storage.set(input.storageKey, id);
  await deps.send({
    id,
    cafe_id: input.cafeId,
    device_id: input.deviceId,
    kind: input.kind,
    payload:
      input.kind === "payment"
        ? { ...input.payload, request_id: "mobile-" + id }
        : input.payload,
  });
  await deps.refresh();
  await deps.storage.remove(input.storageKey);
  return id;
}
