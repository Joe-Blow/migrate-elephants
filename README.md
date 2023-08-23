# migrate-elephants

## TLDR;

If you do not like ORMS. If you do not like migration tools that force you to have a million migration files, but keeping everying synced without one is a PITA.

Then you might like this little tool.

## What does it do

migrate-elephants cli takes a path to a SQL file and a Postgres database url. It compares the SQL file to the DB and essentially diffs the two. The idea here is that you have one setup file that is the "source of truth" for your DB. With this tool you can easily see the difference between all your local, staging, testing and production DBs.

This tool will check the types on the columns as well as most constraints like UNIQUE and NOT NULL. There are some weird edge cases with bigserial and bigint in pgsql-parser, the parser I used to parse the SQL.

## What does it NOT do

Currently this tool only works with Postgres. It also does not support many of the more advanced features of Postgres like triggers, procedures, views, etc. Hopefully this will happen sometime in the near future.

## Installation

`npm install -g migrate-elephants`

Once I get this published on npm that is...

## Usage

`migrate-elephants --file=path/to/file.sql --database=dburl`

If you run migrate-elephants without the --database flag it will check the local folder for a .env file with a DATABASE_URL variable and use it. This allows you to use migrate-elephants in your npm scripts and have it default to to the local dev environment.

When connecting to a remote db, make sure to run with the --ssl-on flag.
