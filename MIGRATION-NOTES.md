# Migration Notes

This archive replaces the following repository files with **complete files**:

- `docs/Software-Application-Document.md`
- `README.md`
- `.env.example`
- `makefile`
- `scripts/backup-db.sh`
- `scripts/restore-db.sh`

Copy the files to their corresponding repository paths. Back up any local customizations first. This package **does not change running services or data** and does not edit your real `.env`.

## Remove obsolete container artifacts after review

The GitHub repository still contains Docker deployment artifacts. Once you confirm Docker is no longer part of your deployment, remove these obsolete files from your repository **if present**:

```bash
git rm -f docker-compose.yml
# Review any Dockerfiles and .dockerignore before deleting them:
find . -name Dockerfile -o -name .dockerignore
# Then git rm the specific obsolete paths you confirm.
```

Avoid deleting files that your CI or another deployment still uses. Review CI workflows and any external deployment scripts for Docker commands.

## Validate

```bash
bash -n scripts/backup-db.sh scripts/restore-db.sh
make help
npm run build
npm run lint
```

No Docker commands, Compose service names, or container-specific URLs remain in the active README/Makefile/scripts. Existing historical references to Docker in the Software Application Document are intentionally phrased as *not used*.

## Commit

```bash
git add README.md docs/Software-Application-Document.md .env.example makefile scripts/backup-db.sh scripts/restore-db.sh
git commit -m "docs: document native PostgreSQL and Node deployment without Docker"
git push origin main
```

Documentation and scripts have not been tested against your actual local database. Confirm your current Vite proxy and API port before starting the services.
