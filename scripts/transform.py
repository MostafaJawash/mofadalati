import json, os, re, sys
sys.stdout.reconfigure(encoding='utf-8')
rows = json.load(open("rows.json", encoding="utf-8"))
EMPTY = ('', 'ـ', None)
NUM = re.compile(r'^[/%\s]*(\d+(?:\.\d+)?)[/%\s]*(?:درجة)?$')

def track(m, c):
    mm = NUM.match(m) if m else None
    minimum = float(mm.group(1)) if mm else None
    parts = []
    if m not in EMPTY and not mm: parts.append(m)
    if c not in EMPTY: parts.append(c)
    available = minimum is not None or bool(parts)
    return minimum, available, ' — '.join(parts) or None


def clean(t):
    if not t: return t
    if 'يب 6ي د' in t:
        t = re.sub(r'% 0يب 6ي د رل جدي ةن يفة ال ة ا ي', '60% درجة في التربية الدينية', t)
    if 'التربية الدينية و / 60%' in t or 'يبي %ة 0' in t:
        return 'شريطة حيازة الطالب على 60% في التربية الدينية و60% في اللغة العربية'
    if 'امتحان مقابلة' in t:
        return 'شريطة حيازة الطالب على 70% درجة لغة أجنبية و70% درجة لغة عربية — امتحان مقابلة من 2026/10/11 ولغاية 2026/10/13، والناجحين بالمقابلة امتحان تحريري في 2026/10/15'
    if t == '/ % / 80 درجة لغة أجنبية / % / 80 درجة لغة عربية':
        return '80% درجة لغة أجنبية و80% درجة لغة عربية'
    for a, b in [('العالمة', 'العلامة'), ('عالمة', 'علامة'), ('أالدىن', 'الأدنى'), ('الحد الدن', 'الحد الأدنى'), ('الختبار', 'الاختبار'),
                 ('طري ت', 'طبي'), ('موسي ف', 'موسيقي'), ('أالجنبية', 'الأجنبية'), ('أالقل', 'الأقل'), ('الرغية', 'الرغبة'),
                 ('اللختبار يويم أالربعاء', 'للاختبار يومي الأربعاء'), ('لالختبار يويم أالربعاء', 'للاختبار يومي الأربعاء'),
                 ('الثالثاء', 'الثلاثاء'), ('لالاختبار يويم أالربعاء', 'للاختبار يومي الأربعاء'), ('عالمة / 70% /', 'علامة 70%'), ('علامة / 70% /', 'علامة 70%')]:
        t = t.replace(a, b)
    t = re.sub(r'(\d+) / (\d+) / (\d+)', r'\1/\2/\3', t)
    return t

out = []
for i, r in enumerate(rows):
    city = r['city'].replace('إدلب / شمدا', 'إدلب / سرمدا')
    gmin, gav, gcond = track(r['gm'], r['gc']); gcond = clean(gcond)
    pmin, pav, pcond = track(r['pm'], r['pc']); pcond = clean(pcond)
    out.append(dict(specialization=r['name'], city=city, university=None, category='ministry',
        general_available=gav, general_minimum=gmin, general_conditions=gcond,
        parallel_available=pav, parallel_minimum=pmin, parallel_conditions=pcond,
        source_page=r['page']))

EXAM = 'يشترط لتدوين أي رغبة أن يكون الطالب قد اجتاز بنجاح امتحان القبول الذي تم إجراؤه من قبل الجامعة في المواعيد التي تم الإعلان عنها'
DEF = 'الجامعة الوطنية للعلوم الدفاعية'
SEC = 'الجامعة السورية للعلوم الأمنية'
extra = [
 (DEF, 'الحربية البرية (الهندسة الميكانيكية) - ذكور فقط', 'حمص', 70, '2026-2025-2024'),
 (DEF, 'الحربية البرية (الهندسة الإلكترونية) - ذكور فقط', 'حمص', 70, '2026-2025-2024'),
 (DEF, 'الحربية البرية (الهندسة المعلوماتية) - ذكور فقط', 'حمص', 70, '2026-2025-2024'),
 (DEF, 'الحربية البرية (الهندسة الميكاترونكس) - ذكور فقط', 'حمص', 70, '2026-2025-2024'),
 (DEF, 'الحربية البحرية (الهندسة البحرية) - ذكور فقط (الدوام في الأعوام القادمة باللاذقية)', 'دمشق', 70, '2026-2025-2024'),
 (DEF, 'الحربية الجوية (هندسة الطيران) - ذكور فقط', 'حلب', 70, '2026-2025-2024'),
 (DEF, 'المعهد العالي للعلوم التطبيقية والتكنولوجيا (الهندسة المعلوماتية - الذكاء الصنعي)', 'دمشق', 85, '2026-2025'),
 (DEF, 'المعهد العالي للعلوم التطبيقية والتكنولوجيا (الهندسة المعلوماتية - البرمجيات)', 'دمشق', 85, '2026-2025'),
 (DEF, 'المعهد العالي للعلوم التطبيقية والتكنولوجيا (الهندسة الإلكترونية - الاتصالات)', 'دمشق', 85, '2026-2025'),
 (DEF, 'المعهد العالي للعلوم التطبيقية والتكنولوجيا (الهندسة الإلكترونية - نظم التحكم الذكية)', 'دمشق', 85, '2026-2025'),
 (DEF, 'المعهد العالي للعلوم التطبيقية والتكنولوجيا (الهندسة الإلكترونية - الميكاترونكس)', 'دمشق', 85, '2026-2025'),
 (DEF, 'المعهد العالي للعلوم التطبيقية والتكنولوجيا (الهندسة الكيميائية - علوم وهندسة المواد)', 'دمشق', 85, '2026-2025'),
 (DEF, 'المعهد العالي للعلوم التطبيقية والتكنولوجيا (الهندسة الكيميائية - تكنولوجيا الوقود)', 'دمشق', 85, '2026-2025'),
 (DEF, 'المعهد العالي للعلوم التطبيقية والتكنولوجيا (هندسة الطيران) - فرع حلب', 'حلب', 85, '2026-2025'),
 (DEF, 'كلية العلوم الإنسانية والإدارية (إدارة واقتصاد) - ذكور فقط', 'دمشق', 70, '2026-2025-2024'),
 (DEF, 'كلية العلوم الإنسانية والإدارية (علوم قانونية) - ذكور فقط', 'دمشق', 70, '2026-2025-2024'),
 (DEF, 'كلية العلوم الإنسانية والإدارية (العلوم الاجتماعية) - ذكور فقط', 'دمشق', 70, '2026-2025-2024'),
 (SEC, 'كلية الأمن السيبراني - ذكور', None, 85, '2026-2025'),
 (SEC, 'كلية الأمن السيبراني - إناث', None, 85, '2026-2025'),
 (SEC, 'كلية العلوم الأمنية - ذكور فقط', None, 80, '2026-2025'),
 (SEC, 'المعهد التقاني للأمن السيبراني - ذكور', None, 65, '2026-2025'),
 (SEC, 'المعهد التقاني للأمن السيبراني - إناث', None, 65, '2026-2025'),
 (SEC, 'المعهد التقاني للعلوم الأمنية - ذكور فقط', None, 65, '2026-2025'),
]
for uni, name, city, gmin, years in extra:
    out.append(dict(specialization=name, city=city, university=uni, category='defense' if uni == DEF else 'security',
        general_available=True, general_minimum=gmin, general_conditions=f'{EXAM}. الأعوام المقبولة: {years}',
        parallel_available=False, parallel_minimum=None, parallel_conditions=None, source_page=21))

for i, o in enumerate(out): o['source_order'] = i + 1
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "db", "admissions.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(out))
el = [o for o in out if (o['general_available'] and (o['general_minimum'] or 0) <= 83) or (o['parallel_available'] and (o['parallel_minimum'] or 0) <= 83)]
print('eligible', len(el), 'numeric-eligible', sum(1 for o in out if (o['general_minimum'] is not None and o['general_minimum']<=83) or (o['parallel_minimum'] is not None and o['parallel_minimum']<=83)))
print('no tracks', [ (o['specialization'],o['city']) for o in out if not o['general_available'] and not o['parallel_available']])
print('G not avail', [(o['specialization'],o['city'],o['parallel_minimum']) for o in out if not o['general_available'] and o['parallel_available']][:20])
print('P not avail', [(o['specialization'],o['city'],o['general_minimum']) for o in out if o['general_available'] and not o['parallel_available'] and o['category']=='ministry'][:40])
