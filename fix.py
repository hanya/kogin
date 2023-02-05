
import os
import re

def main():
    exp = re.compile('"overWarpLineWidth": \d')

    add = ''',
  "overGrainOffsetRatio": 0.1,
  "overWarpOffsetRatio": 0.1'''
    def repl(m):
        return m.group(0) + add

    for name in os.listdir('kogin-templates'):
        if name.endswith('.svg'):
            path = 'kogin-templates/' + name
            with open(path) as f:
                s = f.read()
            ret = exp.sub(repl, s)
            #print(ret)
            with open(path, 'w') as f:
                f.write(ret)

main()
