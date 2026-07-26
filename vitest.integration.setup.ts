const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const developmentDatabaseUrl = process.env.DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");
}

function parseDatabaseTarget(value: string, variableName: string) {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error(`${variableName} must be a valid PostgreSQL URL`);
  }

  if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
    throw new Error(`${variableName} must use the PostgreSQL protocol`);
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(
      parsedUrl.pathname.replace(/^\//, "")
    ).toLowerCase();
  } catch {
    throw new Error(`${variableName} must contain a valid database name`);
  }

  if (!databaseName) {
    throw new Error(`${variableName} must identify a database`);
  }

  const schemaName = (
    parsedUrl.searchParams.get("schema") ?? "public"
  ).toLowerCase();
  const hostName = parsedUrl.hostname.toLowerCase();
  const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(hostName);

  return {
    databaseName,
    schemaName,
    hostName,
    normalizedHost: isLocalHost ? "local" : hostName,
    port: parsedUrl.port || "5432",
    username: decodeURIComponent(parsedUrl.username).toLowerCase(),
    isLocalHost,
  };
}

const testTarget = parseDatabaseTarget(
  testDatabaseUrl,
  "TEST_DATABASE_URL"
);
const developmentTarget = developmentDatabaseUrl
  ? parseDatabaseTarget(developmentDatabaseUrl, "DATABASE_URL")
  : null;

if (
  developmentTarget &&
  developmentTarget.normalizedHost === testTarget.normalizedHost &&
  developmentTarget.port === testTarget.port &&
  developmentTarget.databaseName === testTarget.databaseName &&
  developmentTarget.schemaName === testTarget.schemaName
) {
  throw new Error("TEST_DATABASE_URL must not target the DATABASE_URL database");
}

const looksLikeTestTarget = [testTarget.databaseName, testTarget.schemaName].some((name) =>
  /(^|[-_])(test|testing|integration|ci)([-_]|$)/.test(name)
);

if (!looksLikeTestTarget) {
  throw new Error(
    "TEST_DATABASE_URL database or schema name must clearly identify a test target"
  );
}

const looksLikeProduction = [
  testTarget.hostName,
  testTarget.databaseName,
  testTarget.schemaName,
  testTarget.username,
].some((value) => /(^|[-._])(prod|production)([-._]|$)/.test(value));

if (looksLikeProduction) {
  throw new Error("TEST_DATABASE_URL appears to target production");
}

if (!testTarget.isLocalHost && process.env.ALLOW_REMOTE_TEST_DATABASE !== "1") {
  throw new Error(
    "Remote TEST_DATABASE_URL requires ALLOW_REMOTE_TEST_DATABASE=1"
  );
}

process.env.DATABASE_URL = testDatabaseUrl;
