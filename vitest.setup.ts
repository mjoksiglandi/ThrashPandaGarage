// Ensure required env vars for tests
if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = "test_secret_that_is_at_least_32_characters_long_for_testing";
}
