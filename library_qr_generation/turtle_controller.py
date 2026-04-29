#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from turtlesim.msg import Pose
from geometry_msgs.msg import Twist

class TurtleControllerNode(Node):
    def __init__(self):
        super().__init__('turtle_controller')
        self.get_logger().info("Turtle Controller has been started.")
        
        # Publisher to send velocity commands
        self.cmd_vel_publisher_ = self.create_publisher(
            Twist, '/turtle1/cmd_vel', 10)
        
        # Subscriber to get the turtle's current pose
        self.pose_subscriber_ = self.create_subscription(
            Pose, '/turtle1/pose', self.pose_callback, 10)

    def pose_callback(self, pose: Pose):
        cmd = Twist()
        limit_high = 11.0
        limit_low = 0.0
        safety_margin = 1.5
        
        if pose.x > (limit_high - safety_margin) or pose.x < (limit_low + safety_margin) \
           or pose.y > (limit_high - safety_margin) or pose.y < (limit_low + safety_margin):
            # Emergency turn 
            cmd.linear.x = 1.0
            cmd.angular.z = 1.2
            self.get_logger().info("Turning to avoid wall!")
        else:
            # Dynamic Proportional Controller
            target_top_speed = 5.0
            max_possible_dist = 5.5
            kp = target_top_speed / max_possible_dist
            
            dist_to_right_wall = limit_high - pose.x
            dist_to_left_wall = pose.x - limit_low
            dist_to_top_wall = limit_high - pose.y
            dist_to_bottom_wall = pose.y - limit_low      
            min_dist = min(dist_to_right_wall, dist_to_left_wall, dist_to_top_wall, dist_to_bottom_wall)
    
            cmd.linear.x = kp * min_dist
            cmd.angular.z = 0.0

        self.cmd_vel_publisher_.publish(cmd)

def main(args=None):
    rclpy.init(args=args)
    node = TurtleControllerNode()
    rclpy.spin(node)
    rclpy.shutdown()

if __name__ == '__main__':
    main()
