-- name: GetCatalogRevision :one
SELECT revision FROM catalog_metadata WHERE singleton = true;
