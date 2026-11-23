"""Generate an explicit synthetic scenario using the inspected Stage 3 implementation.
Usage: python scripts/create_fixture.py <path-to-stage3_engine/vendor>
No network, no CoStar evidence, and no legal approval are implied.
"""
import sys, json, hashlib
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(sys.argv[1]).resolve()))
import stage3, opportunity, compliance_engine as ce, venture_review as vr, vision_assess
facts = dict(type='6', subtype=None, gba=6000, stories=1, ceiling_ft=14,
             ceiling_source='synthetic fixture', drive_in_bays=0,
             listed=[dict(value='demo-suite', suite='A', sf=6000, floor='1')])
space = dict(value='demo-suite', suite='A', sf=6000, monthly_rent=6500,
             rent_psf_year=13, lease_basis='synthetic base rent')
building = dict(address='Illustrative retail shell / not a real property', spaces=[space],
                facts=facts, lat=29.76, lon=-95.37)
where = dict(code='houston', verified=True, place='Illustrative Houston jurisdiction', county='Harris',
             note='Synthetic jurisdiction input; not verified against a real parcel')
def compliance(context, key, search):
    # Explicitly authored demonstration branches; never represented as actual research.
    if key == 'tutoring':
        return dict(status='blocked', gates=['Synthetic demonstration: occupancy conflict'], research=[])
    return dict(status='conditional', gates=['Synthetic demonstration: verify permitted use and occupancy'],
                category_requirements={'limitations':['Illustrative preflight; no official research or legal approval']}, research=[])
with patch.object(opportunity,'find_building',return_value=(building,'houston')), \
     patch.object(opportunity,'load_index',return_value=(None,{})), \
     patch.object(opportunity,'kit_file',return_value=Path('synthetic-no-kit')), \
     patch.object(ce,'context_from_kit',return_value={'facts':facts}), \
     patch.object(ce,'preflight',return_value={'jurisdiction':where,'status':'illustrative','gates':[]}), \
     patch.object(ce,'check_business',side_effect=compliance), \
     patch.object(vr,'property_record',return_value={'id':1}), \
     patch.object(vision_assess,'load_profile',return_value=None):
    result=stage3.run(1,900000,reserve=None,suite='demo-suite',save=False)
result['demo']={'synthetic':True,'title':'Illustrative retail shell',
 'description':'Synthetic building, capital, rent and compliance inputs. Building fit, cost arithmetic, hard gates and ranking calculated by the original Stage 3 Python implementation. No real investigation result is available.',
 'source_commit':'789992abc822c2dc70f92afdc204877386891e4a',
 'source_engine':'project helix/stage3_engine/vendor/stage3.py',
 'real':['26-category registry','building_fit logic','published cost benchmark registry','cash_to_open arithmetic','gate order and status semantics','lexicographic ranking and tie breaks'],
 'illustrative':['6000 sq ft retail shell','14 ft clear height','6500 USD monthly rent','900000 USD budget','no declared reserve','compliance responses and jurisdiction']}
def relabel(obj):
    if isinstance(obj,dict):
        for k,v in list(obj.items()):
            if isinstance(v,str) and ('CoStar' in v or 'Census geocoder' in v):
                obj[k]='[SYNTHETIC property evidence] '+v
            else: relabel(v)
    elif isinstance(obj,list):
        for x in obj: relabel(x)
relabel(result)
result['reproduce']['command']='python scripts/create_fixture.py <path-to-stage3_engine/vendor>'
result['reproduce']['endpoint']='unavailable: synthetic fixture, not an investigation endpoint'
result['reproduce']['output_hash']=hashlib.sha256(json.dumps(
    {k:v for k,v in result.items() if k not in ('generated_at','reproduce')},sort_keys=True,default=str
).encode()).hexdigest()[:16]
target=Path(__file__).resolve().parents[1]/'public'/'fixture.json'
target.write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result['summary'],indent=2))


