---
id: chat-interceptor
title: 聊天消息拦截
---

在 `TRPGEngine` 会内置一些自定义的指令，来用于快速投骰操作。这个行为在 `TRPGEngine` 中叫聊天消息拦截，意思是拦截用户发送的信息，如果其满足一定的规则则将其转换为内置的处理。

目前`TRPG Engine`支持的聊天消息拦截器有:

- `/act [消息内容]` 或 `/a [消息内容]`: 发送消息内容, 消息类型强制转化为**动作消息**
- `/speak [消息内容]` 或 `/s [消息内容]`: 发送消息内容, 消息类型强制转化为**会话消息**
- `/ooc [消息内容]`: 发送消息内容, 消息类型强制转化为**OOC消息**

- `.r[A]d[B]`: 普通投骰, `[A]`为投骰个数(默认为1)，`[B]`为投骰面数(默认为100)。 投骰个数的上限为100, 投骰面数上限为1000。即最高可在TRPGEngine的投骰系统中投出100个1000面骰, 默认输入`.rd`会投出1d100

  示例:
  - `.rd`
  - `.r1d100`
  - `.r1d20+4`

- `.ra [属性] [数值]`: 判定骰, `[属性]`如果没有指定数值则会尝试从角色卡的数据中查找, 查找的数值与人物卡数据存储的方式有关, 如果指定了数值则会按照指定数值来判定, 如果投骰结果**小于**判定数值则视为成功。*注意中间要用空格进行分割*

  示例:
  - `.ra 50`
  - `.ra 力量 50`
  - `.ra 力量`

- `.ww<A>[a<B>]`: 无限骰, `<A>`为初始骰数，对初始骰数投出`<A>d10`个结果，如果结果中有大于等于`<B>(默认10)`值则可以相应额外投骰直到没有满足重骰数的值。 `<B>`为重骰值, **5≤`<B>`≤10**

  示例:
  - `.ww5`
  - `.ww5a8`
