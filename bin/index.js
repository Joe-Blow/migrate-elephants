#!/usr/bin/env node

import "dotenv/config";
import chalk from "chalk";
import prs from "pgsql-parser";
import arg from "arg";
import fs from "fs";
import figures from "figures";
import pg from "pg";
const { Pool } = pg;

const parser = prs.parse;

const args = arg({
  "--file": String,
  "--database": String,
  "--ssl-on": Boolean,
});

if (!args["--file"]) {
  console.log(chalk.red.bold("Please provide a file to parse, e.g. --file=users.sql"));
  process.exit(1);
}

if (!args["--database"] && !process.env.DATABASE_URL) {
  console.log(chalk.red.bold("Please provide a database url, e.g. --database=dburl or set DATABASE_URL in local .env"));
  process.exit(1);
}

console.log(chalk.blue.bold(" Starting to chase the elephants...\n"));

let ssl = false; // default to false for local dev

if (args["--ssl-on"]) {
  ssl = {
    rejectUnauthorized: false,
  };
}

const db = new Pool({
  connectionString: args["--database"] || process.env.DATABASE_URL,
  ssl,
});

const file = args["--file"];
const SQL = fs.readFileSync(file, "utf8").toString();

let ast;
try {
  ast = parser(SQL);
} catch (e) {
  console.log(chalk.red.bold("Failed to parse SQL file"));
  console.log(e);
  process.exit(1);
}

const typeMap = {
  bigint: "bigserial",
  bigserial: "bigint",
  "character varying": "varchar",
  boolean: "bool",
  "double precision": "double",
  "timestamp without time zone": "timestamp",
  "timestamp with time zone": "timestamptz",
  integer: "int4",
  character: "char",
};

const contraintMap = {
  "PRIMARY KEY": "CONSTR_PRIMARY",
  UNIQUE: "CONSTR_UNIQUE",
  "NOT NULL": "CONSTR_NOTNULL",
  CHECK: "CONSTR_CHECK",
};

let tablesOK = 0;
let totalTables = 0;
let totalSchemas = 0;
let schemasOk = 0;
let nExtensions = 0;
let extentionsOk = 0;

for (let row of ast) {
  const table = row.RawStmt.stmt.CreateStmt;
  const schema = row.RawStmt.stmt.CreateSchemaStmt;
  const extention = row.RawStmt.stmt.CreateExtensionStmt;

  if (table) {
    let tableOk = true;
    totalTables++;

    const schemaName = table.relation.schemaname || "public";
    const tableName = table.relation.relname;

    let dbTable = await db.query(
      `SELECT * FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2`,
      [schemaName, tableName]
    );

    if (dbTable.rowCount <= 0) {
      console.log(chalk.red.bold(` ${figures.cross} Table ${schemaName}.${tableName} does not exist`));
      tableOk = false;
    } else {
      for (let column of table.tableElts) {
        if (column.Constraint) {
          // need to handle multi column constraints
          continue;
        }
        const columnExists = dbTable.rows.find(c => c.column_name === column.ColumnDef.colname);
        if (!columnExists) {
          console.log(
            chalk.red.bold(
              ` ${figures.cross} Column ${column.ColumnDef.colname} on ${schemaName}.${tableName} is missing on the db`
            )
          );
          tableOk = false;
        }
      }

      for (let column of dbTable.rows) {
        const columnExists = table.tableElts.find(c => c.ColumnDef.colname === column.column_name);
        if (!columnExists) {
          tableOk = false;
          console.log(
            chalk.yellowBright.bold(
              ` ${figures.warning} Column ${column.column_name} on ${schemaName}.${tableName} exists on the db but is missing in the file`
            )
          );
          continue;
        }

        let constraints = columnExists.ColumnDef.constraints;
        if (constraints) {
          constraints = constraints.filter(
            c => c.Constraint.contype !== "CONSTR_DEFAULT" && c.Constraint.contype !== "CONSTR_FOREIGN"
          );

          let dbConstraints = await db.query(
            `SELECT *
              FROM information_schema.table_constraints tc
                INNER JOIN information_schema.constraint_column_usage cu
                ON cu.constraint_name = tc.constraint_name
              WHERE tc.table_name = $1 AND cu.column_name = $2`,
            [tableName, column.column_name]
          );
          dbConstraints = dbConstraints.rows;

          for (let constraint of constraints) {
            let exists = dbConstraints.find(c => constraint.Constraint.contype === contraintMap[c.constraint_type]);

            if (!exists) {
              if (constraint.Constraint.contype === "CONSTR_NOTNULL" && column.is_nullable === "NO") {
                continue;
              }

              console.log(
                chalk.yellowBright.bold(
                  ` ${figures.warning} Constraint ${constraint.Constraint.contype} does not exist on ${schemaName}.${tableName} for column ${column.column_name}`
                )
              );

              tableOk = false;
            }
          }
        }

        let types = columnExists.ColumnDef?.typeName?.names.filter(x => x.String.str !== "pg_catalog");
        const shouldBeType = types[0]?.String.str;
        const dbColType = column.data_type;

        if (shouldBeType === "bigint" || shouldBeType === "bigserial" || shouldBeType === "int8") {
          continue;
        }

        if (dbColType !== shouldBeType && typeMap[dbColType] !== shouldBeType) {
          // this a hack but who cares
          console.log(
            chalk.yellowBright.bold(
              ` ${figures.warning} Column ${column.column_name} on ${schemaName}.${tableName} is ${dbColType} should be ${shouldBeType}`
            )
          );
          tableOk = false;
        }
      }
    }

    if (tableOk) {
      tablesOK++;
    }
  }

  if (schema) {
    totalSchemas++;

    const schemaName = schema.schemaname;
    const dbSchema = await db.query(
      `SELECT * FROM information_schema.schemata
        WHERE schema_name = $1`,
      [schemaName]
    );

    if (dbSchema.rowCount <= 0) {
      console.log(chalk.red.bold(` ${figures.cross} Schema ${schemaName} does not exist`));
    } else {
      schemasOk++;
    }
  }

  if (extention) {
    nExtensions++;

    const extentionName = extention.extname;
    const dbExtention = await db.query(
      `SELECT * FROM pg_extension
        WHERE extname = $1`,
      [extentionName]
    );

    if (dbExtention.rowCount <= 0) {
      console.log(chalk.red.bold(` ${figures.cross} Extention ${extentionName} does not exist`));
    } else {
      extentionsOk++;
    }
  }
}

console.log(chalk.blue.bold(`\n ${figures.info} ${totalTables} tables checked`));
console.log(chalk.blue.bold(` ${figures.info} ${totalSchemas} schemas checked`));
console.log(chalk.blue.bold(` ${figures.info} ${nExtensions} extentions checked`));
console.log(chalk.green.bold(` ${figures.tick} ${tablesOK} tables ok`));
console.log(chalk.green.bold(` ${figures.tick} ${schemasOk} schemas ok`));
console.log(chalk.green.bold(` ${figures.tick} ${extentionsOk} extentions ok\n`));
