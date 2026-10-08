module.exports = {
  setupFiles: ["reflect-metadata"],
  testEnvironment: "node",
  testMatch: ["**/*.spec.ts"],
  transform: { "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
};
