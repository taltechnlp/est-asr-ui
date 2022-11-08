
import sys
import json


def scale_json(filename):
    with open(filename, "r") as f:
        file_content = f.read()

    json_content = json.loads(file_content)
    data = json_content["data"]
    channels = json_content["channels"]
    # number of decimals to use when rounding the peak value
    digits = 2

    max_val = float(max(data))
    new_data = []
    for x in data:
        new_data.append(round(x / max_val, digits))
    # audiowaveform is generating interleaved peak data when using the --split-channels flag, so we have to deinterleave it
    if channels > 1:
        deinterleaved_data = deinterleave(new_data, channels)
        json_content["data"] = deinterleaved_data
    else:
        json_content["data"] = new_data
    file_content = json.dumps(json_content, separators=(',', ':'))

    with open(filename, "w") as f:
        f.write(file_content)


def deinterleave(data, channelCount):
    # first step is to separate the values for each audio channel and min/max value pair, hence we get an array with channelCount * 2 arrays
    deinterleaved = [data[idx::channelCount * 2] for idx in range(channelCount * 2)]
    new_data = []

    # this second step combines each min and max value again in one array so we have one array for each channel
    for ch in range(channelCount):
        idx1 = 2 * ch
        idx2 = 2 * ch + 1
        ch_data = [None] * (len(deinterleaved[idx1]) + len(deinterleaved[idx2]))
        ch_data[::2] = deinterleaved[idx1]
        ch_data[1::2] = deinterleaved[idx2]
        new_data.append(ch_data)
    return new_data


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python scale_json.py file.json")
        exit()
    filename = sys.argv[1]
    scale_json(filename)