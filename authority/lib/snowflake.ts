
/**
 * Snowflake ID Generator
 * 
 * Structure:
 * - 42 bits: Timestamp (in milliseconds)
 * - 10 bits: Worker ID
 * - 12 bits: Sequence number
 */
class Snowflake {
  private epoch: bigint;
  private workerId: bigint;
  private sequence: bigint = 0n;
  private lastTimestamp: bigint = -1n;

  constructor(workerId: bigint = 1n, epoch: bigint = 1715263200000n) {
    // 10 bits for workerId (0-1023)
    this.workerId = workerId & 0x3FFn;
    this.epoch = epoch;
  }

  public generate(): bigint {
    let timestamp = BigInt(Date.now());

    if (timestamp < this.lastTimestamp) {
      throw new Error("Clock moved backwards. Refusing to generate ID.");
    }

    if (timestamp === this.lastTimestamp) {
      // 12 bits for sequence (0-4095)
      this.sequence = (this.sequence + 1n) & 0xFFFn;
      if (this.sequence === 0n) {
        // Sequence exhausted, wait for next millisecond
        while (timestamp <= this.lastTimestamp) {
          timestamp = BigInt(Date.now());
        }
      }
    } else {
      this.sequence = 0n;
    }

    this.lastTimestamp = timestamp;

    // Shift bits into place
    // 22 bits = 10 (worker) + 12 (sequence)
    return ((timestamp - this.epoch) << 22n) |
           (this.workerId << 12n) |
           this.sequence;
  }
}

// Export a singleton instance
export const snowflake = new Snowflake();
export const generateSnowflake = () => snowflake.generate();
