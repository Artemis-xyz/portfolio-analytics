#!/bin/bash

FILE="src/pages/Portfolio.tsx"

# 1. Remove close_price and cost_basis from newHoldingForm state definition
sed -i.bak1 '587,594s/close_price: '\'''\'',$//g' "$FILE"
sed -i.bak2 '587,594s/cost_basis: '\'''\'',$//g' "$FILE"

# Clean up extra commas
sed -i.bak3 's/quantity: '\'''\'',$/quantity: '\'''\'',/g' "$FILE"
sed -i.bak4 's/asset_type: '\'''\'',$/asset_type: '\'''\'',/g' "$FILE"

echo "Changes applied to $FILE"
