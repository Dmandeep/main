import re

with open('prisma/schema.prisma', 'r') as f:
    text = f.read()

# Remove directUrl
text = re.sub(r'^\s*directUrl\s*=\s*env\("DIRECT_URL"\).*?\n', '', text, flags=re.MULTILINE)

# Also fix the fields that missed @db.ObjectId
fields_to_fix = [
    'institutionId', 'projectId', 'milestoneId', 'creatorId', 'tenantId', 'actorId'
]
lines = text.split('\n')
for i, line in enumerate(lines):
    for field in fields_to_fix:
        if line.strip().startswith(field + ' '):
            if 'String' in line and '@db.ObjectId' not in line:
                lines[i] = line.replace('String', 'String @db.ObjectId')
                lines[i] = lines[i].replace('String @db.ObjectId?', 'String? @db.ObjectId')

with open('prisma/schema.prisma', 'w') as f:
    f.write('\n'.join(lines))
