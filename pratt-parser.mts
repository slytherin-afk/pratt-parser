import readline from "readline";

enum TokenType {
  EOF = "Eof",
  ERROR = "Error",
  NUMBER = "Number",
  PLUS = "+",
  MINUS = "-",
  STAR = "*",
  BANG = "!",
  SLASH = "/",
  QUESTION = "?",
  COLON = ":",
}

class Token {
  constructor(readonly type: TokenType, readonly message: string) {}
}

function getScanner(input: string) {
  let start = 0;
  let current = 0;
  const helpers = {
    skip: () => {
      while (["\n", "\r", "\t", " "].includes(helpers.peek())) {
        helpers.advance();
      }
    },
    advance: (): string => input[current++],
    peek: (): string => input[current],
    isAtEnd: (): boolean => current >= input.length,
    makeToken: (type: TokenType): Token =>
      new Token(type, input.substring(start, current)),
    makeErrorToken: (type: TokenType, message: string): Token =>
      new Token(type, message),
    makeNumber: (): Token => {
      while (!helpers.isAtEnd() && Number.isInteger(+helpers.peek())) {
        helpers.advance();
      }

      return helpers.makeToken(TokenType.NUMBER);
    },
  };

  return {
    scanToken: (): Token => {
      helpers.skip();

      start = current;

      if (helpers.isAtEnd()) {
        return helpers.makeToken(TokenType.EOF);
      }

      const char = helpers.advance();

      if (Number(+char)) {
        return helpers.makeNumber();
      }

      switch (char) {
        case "+":
          return helpers.makeToken(TokenType.PLUS);
        case "-":
          return helpers.makeToken(TokenType.MINUS);
        case "/":
          return helpers.makeToken(TokenType.SLASH);
        case "*":
          return helpers.makeToken(TokenType.STAR);
        case "?":
          return helpers.makeToken(TokenType.QUESTION);
        case ":":
          return helpers.makeToken(TokenType.COLON);
        case "!":
          return helpers.makeToken(TokenType.BANG);
        default:
          return helpers.makeErrorToken(
            TokenType.ERROR,
            "Unexpected character",
          );
      }
    },
  };
}

class Expression {}

class ErrorExpression extends Expression {}

class _Number extends Expression {
  constructor(readonly value: number) {
    super();
  }
}

class Unary extends Expression {
  constructor(readonly operator: Token, readonly expression: Expression) {
    super();
  }
}

class Binary extends Expression {
  constructor(
    readonly operator: Token,
    readonly left: Expression,
    readonly right: Expression,
  ) {
    super();
  }
}

class Ternary extends Expression {
  constructor(
    readonly condition: Expression,
    readonly left: Expression,
    readonly right: Expression,
  ) {
    super();
  }
}

function getParser(input: string) {
  const scanner = getScanner(input);
  let hadError = false;
  let previous: Token;
  let current: Token;
  let panicMode = false;

  const helpers = {
    reportError: (token: Token, message: string) => {
      if (panicMode) return;
      panicMode = true;
      if (token.type === TokenType.EOF) {
        console.log("Error at end:", message);
      } else {
        console.log("Error:", message);
      }

      hadError = true;
    },
    error: (message: string) => {
      helpers.reportError(previous, message);
    },
    currentError: (message: string) => {
      helpers.reportError(current, message);
    },
    advance: () => {
      previous = current;

      for (;;) {
        const token = scanner.scanToken();
        current = token;

        if (token.type != TokenType.ERROR) {
          break;
        }

        helpers.currentError(current.message);
      }
    },
    consume: (type: TokenType, message: string) => {
      helpers.advance();

      if (current.type === type) {
        return;
      }

      helpers.currentError(message);
    },
  };

  helpers.advance();

  enum Precedence {
    NONE,
    TERM,
    FACTOR,
    UNARY,
  }

  const parser = {
    number: () => {
      return new _Number(+previous.message);
    },
    unary: () => {
      const operator = previous;
      const expression = parser.parsePrecedence(Precedence.UNARY);

      return new Unary(operator, expression);
    },
    binary: (left: Expression) => {
      const operator = previous;
      const right = parser.parsePrecedence(Precedence.TERM + 1);

      return new Binary(operator, left, right);
    },
    ternary: (condition: Expression) => {
      const left = parser.parsePrecedence(Precedence.NONE);

      helpers.consume(TokenType.COLON, "Expected after true condition");

      const right = parser.parsePrecedence(Precedence.NONE);

      return new Ternary(condition, left, right);
    },
    prefixMap: (type: TokenType): (() => Expression) | undefined =>
      ({
        [TokenType.NUMBER]: parser.number,
        [TokenType.MINUS]: parser.unary,
        [TokenType.BANG]: parser.unary,
      }[type]),
    infinixMap: (
      type: TokenType,
    ): ((left: Expression) => Expression) | undefined =>
      ({
        [TokenType.PLUS]: parser.binary,
        [TokenType.MINUS]: parser.binary,
        [TokenType.STAR]: parser.binary,
        [TokenType.SLASH]: parser.binary,
        [TokenType.QUESTION]: parser.ternary,
      }[type]),
    getPrecedence: (type: TokenType) => {
      switch (type) {
        case TokenType.PLUS:
        case TokenType.MINUS:
          return Precedence.TERM;
        case TokenType.SLASH:
        case TokenType.STAR:
          return Precedence.FACTOR;
        case TokenType.BANG:
          return Precedence.UNARY;
        default:
          return Precedence.NONE;
      }
    },
    parsePrecedence: (precedence: number): Expression => {
      helpers.advance();
      const getPrefix = parser.prefixMap(previous.type);

      if (!getPrefix) {
        helpers.error("Expect an expression");

        return new ErrorExpression();
      }

      let prefix = getPrefix();

      while (precedence <= parser.getPrecedence(current.type)) {
        const getInfinix = parser.infinixMap(current.type);

        if (!getInfinix) {
          return prefix;
        }

        helpers.advance();
        prefix = getInfinix(prefix);
      }

      return prefix;
    },
    expression: () => {
      const expression = parser.parsePrecedence(Precedence.NONE);
      helpers.consume(TokenType.EOF, "Expect end of expression");
      return expression;
    },
  };

  return parser;
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    }),
  );
}

async function main() {
  for (;;) {
    const input = await askQuestion("> ");
    const parser = getParser(input);
    const result = parser.expression();

    console.log(result);
  }
}

await main();
