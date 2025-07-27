# Scraper Microservice

This microservice is responsible for scraping content from specified website paths, extracting text, forms, and buttons, and then processing this data with an external AI service. It updates the status of scraping tasks in an internal PostgreSQL database and communicates results back to a main service.

## Features

* **API Endpoint**: Accepts scraping requests with website IDs, paths, and base URLs.
* **Content Extraction**: Extracts text, forms, and buttons from web pages.
* **AI Integration**: Sends extracted data to an AI service for summarization and merging with previous summaries.
* **PostgreSQL Database**: Stores and updates the status of each scraping task (queued, scraping, scraped, failed).
* **Dockerized**: Easily deployable using Docker and Docker Compose.

## Folder Structure

Refer to the `src/` directory for the main application code, organized into `api`, `core`, `db`, `services`, `utils`, and `config` modules.

## Getting Started

### Prerequisites

* Node.js (v20 or higher)
* npm (Node Package Manager)
* Docker and Docker Compose
* An external PostgreSQL database instance

### Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/your-repo/scraper-microservice.git](https://github.com/your-repo/scraper-microservice.git)
    cd scraper-microservice
    ```

2.  **Create and configure `.env` file:**
    Copy the `.env.example` (or create a new `.env`) and fill in your database connection string and external service URLs.

    ```
    PORT=3000
    DATABASE_URL=postgres://your_db_user:your_db_password@your_postgres_[host.com:5432/scraper_db](https://host.com:5432/scraper_db)
    AI_SERVICE_BASE_URL=[http://ai-service.yourdomain.com](http://ai-service.yourdomain.com)
    MAIN_SERVICE_BASE_URL=[http://main-service.yourdomain.com](http://main-service.yourdomain.com)
    LOG_LEVEL=info
    NODE_ENV=production
    ```

3.  **Install Node.js dependencies (for local development/testing):**
    ```bash
    npm install
    ```

### Database Setup (PostgreSQL)

Ensure your PostgreSQL database is running and accessible from where this service will be deployed.

1.  **Configure Sequelize CLI for URI (Optional but Recommended):**
    For `sequelize-cli` to use the `DATABASE_URL` environment variable for migrations, you might need to adjust your `db/config.js` (or a `config/config.json` if you use one for `sequelize-cli`) to read from `process.env.DATABASE_URL`. A common pattern is to have `db/config.js` return an object like this for Sequelize:

    ```javascript
    // src/db/config.js (example for Sequelize)
    require('dotenv').config(); // Ensure dotenv is loaded here too for migrations

    module.exports = {
      development: {
        url: process.env.DATABASE_URL,
        dialect: 'postgres',
        logging: false, // Set to console.log for migration logs
      },
      production: {
        url: process.env.DATABASE_URL,
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false // Adjust based on your cloud provider's SSL cert
          }
        }
      }
    };
    ```
    And ensure your `package.json` scripts for `migrate:up`/`down` are correctly picking up the environment.

2.  **Run Migrations:**
    First, ensure `sequelize-cli` is installed globally or as a dev dependency (`npm install -g sequelize-cli`).
    Then, run the database migrations to create the `scraped_paths` table:
    ```bash
    npm run migrate:up
    ```

### Running the Microservice

#### 1. Using Docker Compose (Recommended for Production/Local Dev)

This will build the Docker image and start the container, connecting to your external PostgreSQL instance.

```bash
docker-compose up --build -d