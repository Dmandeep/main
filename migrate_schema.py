import re

with open('prisma/schema.prisma', 'r') as f:
    text = f.read()

text = text.replace('provider  = "postgresql"', 'provider  = "mongodb"')

relation_fields = {}
for model_match in re.finditer(r'model\s+(\w+)\s+\{([^}]+)\}', text):
    model_name = model_match.group(1)
    body = model_match.group(2)
    rels = re.findall(r'@relation\([^)]*fields:\s*\[([^\]]+)\]', body)
    fields = set()
    for r in rels:
        for f in r.split(','):
            fields.add(f.strip())
    relation_fields[model_name] = fields

lines = text.split('\n')
out_lines = []
current_model = None

for line in lines:
    m = re.match(r'^model\s+(\w+)', line)
    if m:
        current_model = m.group(1)
    
    if current_model and line.strip().startswith('id ') and '@id' in line:
        line = re.sub(r'id\s+String\s+@id\s+@default\(cuid\(\)\)', r'id String @id @default(auto()) @map("_id") @db.ObjectId', line)
    elif current_model and not line.strip().startswith('//'):
        m_field = re.match(r'^\s+(\w+)\s+(String(?:\?|\[\])?)(.*)', line)
        if m_field:
            field_name = m_field.group(1)
            field_type = m_field.group(2)
            rest = m_field.group(3)
            
            if field_name in relation_fields.get(current_model, set()) or field_name == 'evidenceIds':
                if '@db.ObjectId' not in rest:
                    if '//' in rest:
                        parts = rest.split('//', 1)
                        line = f'  {field_name} {field_type}{parts[0]} @db.ObjectId //{parts[1]}'
                    else:
                        line = f'  {field_name} {field_type}{rest} @db.ObjectId'

    out_lines.append(line)

with open('prisma/schema.prisma', 'w') as f:
    f.write('\n'.join(out_lines))
