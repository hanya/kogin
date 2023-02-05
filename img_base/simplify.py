
import os
import os.path
import re
import sys


def main():
    main2(sys.argv[1])

def main2(path):
    with open(path, "r") as f:
        s = f.read()

    exp_style = re.compile(r'\n\s*style="[^"]+?"', re.M)
    exp = re.compile(r'[^i]d="([^"]+?)"', re.M)

    def to_value(v):
        try:
            n = int(v, 10)
            m = str(n)
            return m
        except:
            try:
                n = float(v)
                m = "{:.1f}".format(n)
                if m.endswith('.0'):
                    p = m[0:-2]
                    if p == '-0':
                        return '0'
                    else:
                        return p
                else:
                    return m
            except:
                return None

    def repl(m):
        converted = []
        parts = m.group(1).split(' ')
        for part in parts:
            xy = part.split(',')
            if len(xy) == 2:
                x = to_value(xy[0])
                y = to_value(xy[1])
                if not x is None:
                    if not y is None:
                        converted.append("{},{}".format(x, y))
            else:
                v = to_value(part)
                if not v is None:
                    converted.append(v)
                else:
                    converted.append(part)

        r = " d=\"{}\"".format(' '.join(converted))
        return r

    n = exp.sub(repl, s)
    n = exp_style.sub('', n)
    with open(path, "w") as f:
        f.write(n)

if __name__ == '__main__':
    main()
