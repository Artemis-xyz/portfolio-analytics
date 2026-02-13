#!/usr/bin/env python3
"""Fix Portfolio.tsx to remove cost_basis and make price API-based"""

import re

# Read the file
with open('src/pages/Portfolio.tsx', 'r') as f:
    content = f.read()

# 1. Update newHoldingForm state definition
content = re.sub(
    r"(const \[newHoldingForm, setNewHoldingForm\] = useState\({\s*security_name: '',\s*ticker: '',\s*quantity: '',)\s*close_price: '',\s*cost_basis: '',\s*(asset_type: '',\s*}\);)",
    r"\1\n    \2",
    content
)

# 2. Update handleStartAddNew
content = re.sub(
    r"(const handleStartAddNew = \(\) => {[^}]+security_name: '',\s*ticker: '',\s*quantity: '',)\s*close_price: '',\s*cost_basis: '',\s*(asset_type: '',\s*}\);)",
    r"\1\n      \2",
    content
)

# 3. Update handleCancelAddNew
content = re.sub(
    r"(const handleCancelAddNew = \(\) => {[^}]+security_name: '',\s*ticker: '',\s*quantity: '',)\s*close_price: '',\s*cost_basis: '',\s*(asset_type: '',\s*}\);)",
    r"\1\n      \2",
    content
)

# 4. Replace handleSaveNew function completely
old_save_new = re.search(
    r'const handleSaveNew = async \(\) => {.*?};',
    content,
    re.DOTALL
)

if old_save_new:
    new_save_new = '''const handleSaveNew = async () => {
    if (!user) return;

    // Validation
    if (!newHoldingForm.security_name.trim()) {
      toast.error('Asset name is required');
      return;
    }
    if (!newHoldingForm.ticker.trim()) {
      toast.error('Ticker symbol is required');
      return;
    }
    if (!newHoldingForm.quantity || parseFloat(newHoldingForm.quantity) <= 0) {
      toast.error('Valid quantity is required');
      return;
    }

    // Get price from API
    const ticker = newHoldingForm.ticker.trim().toUpperCase();
    let price = 0;

    if (priceData && priceData[ticker]) {
      price = priceData[ticker].price;
    }

    if (price <= 0) {
      toast.error('Unable to fetch price for this ticker. Please verify the ticker symbol.');
      return;
    }

    try {
      await createHolding.mutateAsync({
        holding: {
          security_name: newHoldingForm.security_name.trim(),
          ticker: ticker,
          quantity: parseFloat(newHoldingForm.quantity),
          close_price: price,
          cost_basis: null,
          asset_type: newHoldingForm.asset_type.trim() || null,
        },
        userId: user.id,
      });

      toast.success('Asset added successfully');
      setIsAddingNew(false);
      setNewHoldingForm({
        security_name: '',
        ticker: '',
        quantity: '',
        asset_type: '',
      });
    } catch (err: any) {
      console.error('Create error:', err);
      toast.error(err.message || 'Failed to add asset');
    }
  };'''

    content = content[:old_save_new.start()] + new_save_new + content[old_save_new.end():]

# 5. Remove Cost Basis column header
content = re.sub(
    r'<th className="text-right[^"]*"[^>]*>Cost Basis</th>\s*<th className="text-right[^"]*"[^>]*>PNL</th>',
    r'<th className="text-right text-[10px] font-medium text-table-header uppercase tracking-wider px-3 py-2">PNL</th>',
    content
)

# 6. Update inline "Add New" row - Replace Price input with display
content = re.sub(
    r'(/\* Price \*/\s*<td className="px-3 py-1\.5">\s*)<input\s+type="number"[^>]*value={newHoldingForm\.close_price}[^>]*onChange=\{[^}]+\}[^>]*/>\s*(</td>)',
    lambda m: m.group(1) + '''<span className="text-[11px] text-muted-foreground tabular-nums">
                              {(() => {
                                const ticker = newHoldingForm.ticker.trim().toUpperCase();
                                if (ticker && priceData && priceData[ticker]) {
                                  return formatUsd(priceData[ticker].price);
                                }
                                return ticker ? '...' : '—';
                              })()}
                            </span>
                          ''' + m.group(2),
    content,
    flags=re.DOTALL
)

# 7. Update Value calculation in inline row
content = re.sub(
    r'{newHoldingForm\.quantity && newHoldingForm\.close_price\s*\? formatUsd\(parseFloat\(newHoldingForm\.quantity\) \* parseFloat\(newHoldingForm\.close_price\)\)',
    r'''{(() => {
                                const ticker = newHoldingForm.ticker.trim().toUpperCase();
                                const qty = parseFloat(newHoldingForm.quantity);
                                if (qty > 0 && ticker && priceData && priceData[ticker]) {
                                  return formatUsd(qty * priceData[ticker].price);
                                }''',
    content
)

# 8. Remove Cost Basis input field from inline row
content = re.sub(
    r'/\* Cost Basis \*/\s*<td className="px-3 py-1\.5">.*?</td>\s*(?=/\* PNL \*/)',
    '',
    content,
    flags=re.DOTALL
)

# 9. Remove Cost Basis display/edit from existing holdings rows
content = re.sub(
    r'/\* Cost Basis \(editable\) \*/\s*<td className="text-right px-3 py-1\.5">.*?</td>\s*(?=/\* PNL \*/)',
    '',
    content,
    flags=re.DOTALL
)

# 10. Update empty state form inputs - remove close_price and cost_basis
content = re.sub(
    r'<label className="text-\[10px\][^>]*>Price \*</label>.*?</div>\s*<div>\s*<label className="text-\[10px\][^>]*>Cost Basis</label>.*?</div>',
    '',
    content,
    flags=re.DOTALL
)

# Write the file back
with open('src/pages/Portfolio.tsx', 'w') as f:
    f.write(content)

print("✅ Portfolio.tsx updated successfully!")
print("Changes made:")
print("  - Removed cost_basis from all forms")
print("  - Made price API-based (auto-fetched)")
print("  - Updated validation to require ticker")
print("  - Removed Cost Basis column from table")
