// ayva 核心
import Ayva from './src/ayva.js';
// 经典笔画
import ClassicStroke from './src/behaviors/classic-stroke.js';
// 测试配置
import { createTestConfig } from './test/test-helpers.js';
// 输出
import ConsoleDevice from './src/devices/console-device.js';

const ayva = new Ayva(createTestConfig());

const device = new ConsoleDevice();
ayva.addOutput(device);

const stroke = new ClassicStroke();
ayva.do(stroke);
