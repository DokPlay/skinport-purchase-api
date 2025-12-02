# Setup development environment: start services and apply DB schema
# Usage: .\scripts\setup-dev.ps1

Write-Host "Installing dependencies..."
npm install

Write-Host "Starting PostgreSQL and Redis containers..."
docker compose up -d

Write-Host "Applying database schema to Postgres container..."
Get-Content .\schema.sql | docker compose exec -T postgres psql -U postgres -d skinport

if (Test-Path .env) {
    Write-Host ".env already exists"
} else {
    Write-Host "Copying .env.example to .env"
    Copy-Item .env.example .env
}

Write-Host "Starting dev server (background)..."
Start-Process -NoNewWindow -FilePath npm -ArgumentList 'run','dev'
Write-Host "Dev server started. Use 'npm run dev' manually to see logs."