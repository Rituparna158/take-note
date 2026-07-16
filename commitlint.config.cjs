const TICKET_PATTERN = /AB[-#]\d+/i;

module.exports = {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "azure-boards-ticket-reference": (parsed) => {
          const { type, header } = parsed;
          if (type !== "feat" && type !== "fix") {
            return [true];
          }
          return [
            TICKET_PATTERN.test(header ?? ""),
            "feat/fix commits must reference an Azure Boards ticket, e.g. `feat(scope): description AB#1001`",
          ];
        },
      },
    },
  ],
  rules: {
    "azure-boards-ticket-reference": [2, "always"],
  },
};
