# 使用python读取funscript_output文件下的demo.json文件 提取其中L0、R1、R2数据作为funscript的actions 输出为三个各自的funscript文件
import json

dir = './funscript_output/'
name = 'demo'

json_file = dir + name + '/' + name + '.json'

funscript = dir + name + '/' + name + '.funscript'
funscript_roll = dir + name + '/' + name + '.roll.funscript'
funscript_pitch = dir + name + '/' + name + '.pitch.funscript'

# Read the JSON file
with open(json_file, 'r') as f:
    data = json.load(f)

# Extract the L0, R1, R2 data
L0_data = data.get('L0')
R1_data = data.get('R1')
R2_data = data.get('R2')

# add funscript template
funscript_template = {
    "version": "1.0",
    "inverted": False,
    "range": 100,
    "actions": []
}

# Add the L0, R1, R2 data to the template
funscript_template['actions'] = L0_data
with open(funscript, 'w') as f:
    json.dump(funscript_template, f)

funscript_template['actions'] = R1_data
with open(funscript_roll, 'w') as f:
    json.dump(funscript_template, f)

funscript_template['actions'] = R2_data
with open(funscript_pitch, 'w') as f:
    json.dump(funscript_template, f)